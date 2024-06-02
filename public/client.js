const socket = io();
let localConnection = new RTCPeerConnection();
let remoteConnection = new RTCPeerConnection();
const dataChannel = localConnection.createDataChannel("channel");

const handleRemoteConnection = async (remoteICE, remoteSocket) => {
  try {
    let rcVariable = remoteICE;
    console.log(`rcVariable: ${rcVariable}`);
    remoteConnection
      .setRemoteDescription(JSON.parse(rcVariable))
      .then((variable) => {
        console.log("Offer set");
      })
      .then(() => {
        remoteConnection.createAnswer().then((answer) => {
          remoteConnection.setLocalDescription(answer).then(() => {
            setTimeout(() => {
              console.log("Answer created");
              socket.emit("send answer", {
                ICE: JSON.stringify(remoteConnection.localDescription),
                socket: remoteSocket,
              });
            }, "5000");
          });
        });
      });
  } catch (error) {
    console.log(`There was an error on handling remote connection: ${error}`);
  }
};

const handleAnswer = async (answerICE) => {
  try {
    let answer = answerICE;
    console.log(answer);
    localConnection
      .setRemoteDescription(JSON.parse(answer))
      .then((variable) => {
        console.log("Received answer");
      });
  } catch (error) {
    console.log(`There was an error on handling answer: ${error}`);
  }
};

//local media

const constraints = {
  video: true,
  audio: false,
};

const openMediaDevices = async (constraints) => {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.error("Error accessing media devices:", error);
    throw error; // Rethrow the error to be caught later
  }
};

//Socket stuff
socket.on("remote ICE", (answer) => {
  console.log("Remote ICE triggered");
  let remoteICE = answer.callerICE;
  let remoteSocket = answer.callerSocket;
  console.log(`Remote ICE triggered ${remoteICE}`);
  handleRemoteConnection(remoteICE, remoteSocket).then(() => {
    console.log("Done");
  });
});

socket.on("remote answer", (data) => {
  let remoteICE = data.remoteICE;
  console.log(`Answer triggered ${remoteICE}`);
  handleAnswer(remoteICE).then(() => {
    console.log("Answer handled");
  });
});

socket.on("connect", () => {
  console.log(`Connected to server socket. Our ID is ${socket.id}`); //This is my socket ID. Assigned when I connect to the server.
});

socket.on("disconnect", () => {
  console.log(`Disconnected from server socket.`); //This is my socket ID. Assigned when I connect to the server.
});

socket.on("my username", (data) => {
  console.log(`My username: ${data.username}`);
});

//For purposes of seeing user IDs and using the "callPerson function"
socket.on("connected clients", (data) => {
  console.log(data.listOfUsers);
});

//My functions
// Main function to handle local media capture and stream assignment
const startLocalStream = async () => {
  try {
    const stream = await openMediaDevices({ video: true, audio: true });
    const localVideo = document.querySelector("video#myself");
    localVideo.srcObject = stream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
};

const sendICECandidateToServer = (connectionDetails) => {
  socket.emit("add ICE", {
    ICE: JSON.stringify(connectionDetails),
  });
};

function callPerson(socketUsername) {
  socket.emit("call person", socketUsername);
}

//Main function
startLocalStream().then(() => {
  //The offer we receive is our SDP, which we can send to other clients. We create an offer and send it to the server for storage through the "addICE" function.
  localConnection.onicecandidate = (event) => {
    console.log(`Received ICE candidate after opening data channel`);
    console.log(JSON.stringify(localConnection.localDescription));
  };

  remoteConnection.onicecandidate = (event) => {
    console.log(`New remote candidate`);
    console.log(JSON.stringify(remoteConnection.localDescription));
  };
  dataChannel.onopen = (event) => {
    console.log("Connection open");
  };

  remoteConnection.ondatachannel = (event) => {
    console.log(`Triggered step 1`);
    remoteConnection.myDataChannel = event.channel;
    remoteConnection.dataChannel.onmessage = (event) => {
      console.log(`New message: ${event.data}`);
    };
    remoteConnection.myDataChannel.onopen = (event) => {
      console.log(`Connection opened`);
    };
  };
  localConnection
    .createOffer()
    .then((offer) => {
      console.log("Creating");
      localConnection.setLocalDescription(offer);
    })
    .then(() => {
      setTimeout(() => {
        console.log("Sending");
        sendICECandidateToServer(localConnection.localDescription);
      }, "5000");
    });
});
