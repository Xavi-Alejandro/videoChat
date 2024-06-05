const express = require("express");
const path = require("path");
const https = require("https");
const fs = require("fs");
const socketIO = require("socket.io");

const options = {
  key: fs.readFileSync(path.join(__dirname, "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
};

const app = express();
const server = https.createServer(options, app);
const io = socketIO(server);

const HTTP_PORT = process.env.PORT || 8080;

// Set EJS as the view engine
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

//Add a map of all clients
let clientMap = new Map();

//messageGivenClient
/*This function receives a socket and a message to be sent to an individual cient 
Used in chatApp server but in this project. Keeping it just in case.*/
let messageClient = function (clientSocket, clientMessageObject) {
  io.to(clientSocket.id).emit("chat message", clientMessageObject);
};

//From chatApp server. Kept for purpose of seeing connected clients on each page.
let broadcastConnectedClients = function (clientMap) {
  let listOfUsers = [];
  let user;
  clientMap.forEach((objectReference, key) => {
    let socketItselt = objectReference.socket;
    let socketId = key;
    user = clientMap.get(socketId).userName;
    //user = user.userName
    console.log(`user: ${user}`);
    listOfUsers.push(user);
  });
  console.dir(listOfUsers);
  io.emit("connected clients", { listOfUsers: listOfUsers });
};

//From chatApp server. Assigns username to each connction, and initializes an empty ICE property to be changed on the "add ICE" socket event. Each connection emits the addICE event once rendered.
io.on("connection", function (socket) {
  //Assign temp username and add to clientMap
  let tempUsername = "User-" + Math.floor(Math.random() * (100000 - 1 + 1)) + 1;
  clientMap.set(socket.id, {
    socket: socket,
    userName: tempUsername,
    ICE: "Empty",
  });
  io.to(socket.id).emit("my username", {
    username: clientMap.get(socket.id).userName,
  });

  //Receive ICE information
  socket.on("add ICE", function (user) {
    console.log(`Adding ICE: ${user.ICE}`);
    clientMap.set(socket.id, {
      socket: clientMap.get(socket.id).socket,
      userName: clientMap.get(socket.id).userName,
      ICE: user.ICE,
    });
    broadcastConnectedClients(clientMap);
  });

  //Call a person by emitting the remoteICE event to that specific socket
  socket.on("call person", function (userName) {
    console.log(`Attempting to call ${userName}`);
    let callerSocket = socket.id;
    let foundSocket = "empty";
    let foundICE;

    //1. Find socket ID with username, then obtain socket.
    clientMap.forEach((objectReference) => {
      console.log(
        `ObjectReferece.username: ${objectReference.userName}, passedUsername: ${userName}`
      );
      //This is not working for some reason. Even though log shows an exact match. It's not matching and being triggered. <---------------------------------------------------
      if (objectReference.userName == userName) {
        foundSocket = objectReference.socket;
      } else {
        console.log(`User name ${userName} not found.`);
      }

      if (!(foundSocket === "empty")) {
        console.log(`User name ${userName} has been found!.`);
        //2. send a message to said socket with the caller's ICE.
        foundICE = clientMap.get(socket.id).ICE;
        io.to(objectReference.socket.id).emit("remote ICE", {
          callerSocket: callerSocket,
          callerICE: foundICE,
        });
        console.log(`Emmitted to socket ${objectReference.socket.id}.
        From socket: ${socket.id}`);
        //3. Event listener will send response to socket.
      }
    });
  });

  socket.on("send answer", function (data) {
    console.log(`sending answer to specific socket. Answer: ${data.ICE}`);
    io.to(data.socket).emit("remote answer", { remoteICE: data.ICE });
  });

  //Let clients know which user disconnected and remove him from the array
  socket.on("disconnect", function () {
    io.emit("cut off typing", {});
    io.emit("chat message", {
      message: `${clientMap.get(socket.id).userName} has disconnected!`,
    });
    clientMap.delete(socket.id);
    broadcastConnectedClients(clientMap);
  });
});

app.get("/", (req, res) => {
  res.render("client");
});

//Listen on port
server.listen(HTTP_PORT, () => {
  console.log(`Server is running on port ${HTTP_PORT}`);
});
