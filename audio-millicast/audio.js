$( document ).ready(function() {
	const url = "wss://live.millicast.com:443/ws/v1/pub";
    const turnUrl = 'https://turn.millicast.com/webrtc/_turn';
    const dataChannelOptions = {
    ordered: true, // do not guarantee order
    maxPacketLifeTime: 3000, // in milliseconds
   };

/*
    //Adding sliders 
         $(function () {
          var videoBitrate = $('#bitrateText').text($(this).val());
          $('#bitrateText').text($('#videoBitrate').val());
          $('#videoBitrate').on('input change', function () {
          $('#bitrateText').text($(this).val());
         // console.log($(this).val());
     
          });
          });

          $(function () {
          var audioBitrate = $('#audioText').text($(this).val());
          $('#audioText').text($('#audioBitrate').val());
          $('#audioBitrate').on('input change', function () {
          $('#audioText').text($(this).val());
          //console.log($(this).val());
          });
          });
          *
         // videoBitrate = $('#bitrateText').text();
         //console.log(videoBitrate);
      */ 

//End
    // hard code it here, or enter it at runtime on the field.
	let token = "YOUR_ TOKEN";
    let streamName = "STREAM_NAME";
    let viewerStreamId = "LZsuF8/STREAM-NAME";
    // /info

		//media stream object from local user mic and camera.	
		let stream;
		//Ice Servers:
		let iceServers = [];
    //form items and variables they are tied to.
    let views = [ 
      {form:'tokenTxt',param:'token'}, 
      {form:'streamTxt',param:'streamName'}, 
      {form:'viewTxt',param:'viewerStreamId'} 
    ];

		function startBroadcast(){
      //if missing params, assume the form has them.
      if(!token || !streamName || !viewerStreamId){
        getFormParams();
      }
			// get a list of Xirsys ice servers.
			getICEServers()
				.then(list => {
          iceServers = list;
					//ready to connect.
					connect();
				})
				.catch( e => {
					alert('getICEServers Error: ',e);
          connect();//proceed with no (TURN)
				});
		}

		function connect(){
			console.log('connecting to: ',url + '?token=' + token);
			//create Peer connection object, add TURN servers for fallback.
      console.log('iceservers: ',iceServers);
			let pc = new RTCPeerConnection( {iceServers:iceServers, bundlePolicy : "max-bundle"} );
			//add media to connection
			stream.getTracks()
				.forEach(track => {
					console.log('audio track: ',track);
					pc.addTrack(track, stream)
				});

			//connect with Websockets for handshake to media server.
			let ws = new WebSocket(url + '?token=' + token);
			ws.onopen = function(){
				//Connect to our media server via WebRTC
				console.log('ws::onopen ',token);
				//create a WebRTC offer to send to the media server
				let offer = pc.createOffer({
					offerToReceiveAudio: true,
					offerToReceiveVideo: true
				}).then( desc => {
					console.log('createOffer Success!');
					//set local description and send offer to media server via ws.
					pc.setLocalDescription(desc)
						.then( () => {
							console.log('setLocalDescription Success !:',streamName);
							//set required information for media server.
							let data = {
								name	: streamName,
								sdp		: desc.sdp,
								//codec   : 'h264'
							}
							//create payload
							let payload = {
								type	: "cmd",
								transId	: Math.random() * 10000,
								name	: 'publish',
								data	: data
							}
							ws.send( JSON.stringify(payload) );
						})
						.catch(e => { 
							console.log('setLocalDescription failed: ',e); 
						})
				}).catch( e => { 
					console.log('createOffer Failed: ',e) 
				});
			}

			ws.addEventListener('message', evt => {
				console.log('ws::message',evt);
				let msg = JSON.parse(evt.data);
				switch(msg.type){
					//Handle counter response coming from the Media Server.
					case "response":
						let data = msg.data;
					let answer = new RTCSessionDescription({
							type: 'answer',
                            sdp : data.sdp + "a=x-google-flag:conference\r\n",
                            //limit video bandwidth 800 Kbps
                            //sdp : data.sdp + "a=MID:video\r\nb=AS:" + $('#bitrateText').text() +"\r\n"
                            //limit audio bandwidth
                            //sdp  : data.sdp + "a=MID:audio\r\nb=AS:"+ $('#audioText').text()  +"\r\n"



						});
						
						pc.setRemoteDescription(answer)
							.then(d => {
								console.log('setRemoteDescription Success! ');
								showViewURL();
							})
							.catch(e => {
								console.log('setRemoteDescription failed: ',e);
							});
						break;
				}
			})
		}

		// Gets ice servers.
		function getICEServers(){
			return new Promise( (resolve, reject) => {
				let xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function(evt){
					if(xhr.readyState == 4) { 
						let res = JSON.parse(xhr.responseText), a;
						console.log('getICEServers::status:',xhr.status,' response: ',xhr.responseText);
						switch(xhr.status){
							case 200:
								//returns array.
								let list = res.v.iceServers;
								a = [];
								//call returns old format, this updates URL to URLS in credentials path.
								list.forEach(cred => {
									let v = cred.url;
									//console.log('cred:',cred);
									if(!!v) { cred.urls = v; delete cred.url; }
									a.push(cred);
								});
								//console.log('ice: ',a);
								resolve(a);
								break;
							default:
								a = [];
								//reject(xhr.responseText);
								//failed to get ice servers, resolve anyway to connect w/ out.
								resolve(a);
								break;
						}
					}
				}
				xhr.open("PUT", turnUrl, true);
				xhr.send();
			})
		}

		function getMedia(){
			return new Promise( (resolve, reject) => {
        
        let constraints = {
        	audio:true,
            video: false,
 


        }; 
				navigator.mediaDevices.getUserMedia(constraints)
					.then( str => {
						resolve(str);
					}).catch(err => { 
						console.error('Could not get Media: ', err);
						reject(err);
					})
			});
		}

		// Display the path to the viewer and passes our id to it.
		function showViewURL(){
      //if no viewer stream id is provided, path to viewer not shown.
      if(!!viewerStreamId){
        let vTxt = document.getElementById('viewerUrl');
        let href = (location.href).split('?')[0];
        console.log('href:',href,', indexOF ', href.indexOf('htm'),'lastindex /',href.lastIndexOf('/'));
        if(href.indexOf('htm') > -1) href = href.substring(0,href.lastIndexOf('/')+1);
        let url = href + 'listen.html?streamId='+viewerStreamId;
        vTxt.innerText = 'Viewer Path:\n' + url;
        vTxt.setAttribute('href',url);
      }

			//disable publish button.
			let btn = document.getElementById('publishBtn');
			btn.innerHTML = 'BROADCASTING LIVE';
			btn.disabled = true;

      //hide form
      document.getElementById('form').setAttribute("style", "display: none;");
		}

		//START
		
		function ready(){
			console.log('Millicast token: ',token);
			//sets required data to broadcast and view.
			setParams();

			//Setup publish button
			let pubBtn = document.getElementById('publishBtn');
			if(pubBtn) pubBtn.onclick = evt => { startBroadcast(); };
			
			//Get users camera and mic
			getMedia()
				.then( str => {
					stream = str;
					//set cam feed to video window so user can see self.
					let vidWin = document.getElementsByTagName('video')[0];
					if(vidWin) vidWin.srcObject = stream;
				})
				.catch( e => {
					alert('getUserMedia Error: ',e);
				});
		}
    //sets required data to broadcast and view.
    function setParams(){
      //get millicast id from url if undefined in variable above. otherwise use show a form at runtime.
      let params = new URLSearchParams(document.location.search.substring(1));
			if(!token){//if we have token, bypass this.
				token = params.get('token');//if no token, try url params.
			}
      if(!streamName){
        streamName = params.get('streamName');
      }
      if(!viewerStreamId){
        viewerStreamId = params.get('viewerStreamId');
      }

      console.log('setParams - token:',token,' name: ',streamName,', viewer ID:', viewerStreamId,', mc url:',url,', TURN url',turnUrl);
      //if still missing token in the URLS for any of them, show form.
      if(!token || !streamName || !viewerStreamId) {
        document.getElementById('form').setAttribute("style", "display: unset;");
        let i, l = views.length;
        for(i=0; i<l; i++){
          let item = views[i];
          let txt = document.getElementById(item.form);
          console.log('item ',item,' txt:',txt);
          switch(item.param) {
            case 'token': txt.value = !!token ? token : ''; break;
            case 'streamName': txt.value = !!streamName ? streamName : ''; break;
            case 'viewerStreamId': txt.value = !!viewerStreamId ? viewerStreamId : ''; break;
          }
        }
      }
    }

    function getFormParams(){
      let i, l=views.length;
      for(i=0; i<l; i++){
        let item = views[i];
        let txt = document.getElementById(item.form).value;
        console.log('item ',item,' txt:',txt);
        switch(item.param){
          case 'token': token = txt; break;
          case 'streamName': streamName = txt; break;
          case 'viewerStreamId': viewerStreamId = txt; break;
        }
      }
      console.log('getFormParams - token:',token,', streamName:',streamName,', viewerStreamId:',viewerStreamId);
    }

		if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading"){
			ready();
		} else {
			document.addEventListener('DOMContentLoaded', ready );
		}

});