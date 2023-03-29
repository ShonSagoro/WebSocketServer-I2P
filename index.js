import express from "express";
import morgan from "morgan";
import { Server as SocketServer } from "socket.io";
import http from "http";
import cors from "cors";
import { PORT } from "./config.js";
import dotenv from 'dotenv';
import amqp from "amqplib";

dotenv.config();

const hostname = process.env.HOST || "localhost";
const protocol = process.env.PROTOCOL;
const user = process.env.USER;
const password = process.env.PASSWORD;
const port = process.env.PORT;

const queueLoginRes = process.env.QUEUE_RESPONSE_LOGIN;
const queueRegisterRes = process.env.QUEUE_RESPONSE_REG;
const queueIrrigationRes = process.env.QUEUE_RESPONSE_IRRIGATION;
const queueSystemRes = process.env.QUEUE_RESPONSE_SYSTEM;
const queueSystemChangeRes = process.env.QUEUE_CHANGE_SYSTEM_RESPONSE;
const queueIrrigationChangeRes = process.env.QUEUE_CHANGE_IRRIGATION_RESPONSE;

const rabbitSettings = {
  protocol: protocol,
  hostname: hostname,
  port: port,
  username: user,
  password: password,
};

async function connect() {
  try {
    const connected = await amqp.connect(rabbitSettings);
    console.log("conexion exitosa");
    return connected;
  } catch (error) {
    console.error("Error =>", error);
    return null;
  }
}

async function createChannel(connection, queue) {
  const channel = await connection.createChannel();
  await channel.assertQueue(queue);
  return channel;
}

const app = express();
const server = http.createServer(app);
const io=new SocketServer(server, {
  cors:{
      origin: ['http://127.0.0.1:5173']
  }
});

app.use(cors());
app.use(morgan("dev"));
const listSockets = {};

io.on("connection", async (socket) => {
  console.log("new user", socket.id);

  if (listSockets[socket.id] === undefined) {
    listSockets[socket.id] = {
      idSocket: socket.id,
      module: "",
      id: 0,
    };
  }

  const connection = await connect();


  const channelLoginRes = await createChannel(connection, queueLoginRes);
  const channelRegisternRes = await createChannel(connection, queueRegisterRes);
  const channelIrrigationRes = await createChannel(connection,queueIrrigationRes);
  const channelSystemRes = await createChannel(connection, queueSystemRes);
  const channelSystemChangeRes = await createChannel(connection, queueSystemChangeRes);
  const channelIrrigationChangeRes = await createChannel(connection, queueIrrigationChangeRes);


  channelSystemChangeRes.consume(queueSystemChangeRes, (response)=>{
    const id = JSON.parse(response.content.toString());
    console.log("received in change system response",id);

    const queue = process.env.QUEUE_REQUEST_SYSTEM;
    const objectform={
      id: id,
      socketId: socket.id
    }
    sendQueue(objectform, queue);
    console.log("peticion enviado");
  

    channelSystemChangeRes.ack(response);
  });
  channelIrrigationChangeRes.consume(queueIrrigationChangeRes, (response)=>{
    const id = JSON.parse(response.content.toString());
    console.log("received in change irrigation response",id);
    const queue = process.env.QUEUE_REQUEST_IRRIGATION;
    const objectform={
      id: id,
      socketId: socket.id
    }
    sendQueue(objectform, queue);
    console.log("peticion enviado");
  

    channelIrrigationChangeRes.ack(response);
  });

channelLoginRes.consume(queueLoginRes, (response) => {
  const objectRecieved = JSON.parse(response.content.toString());
  console.log("received in login",objectRecieved);

  io.to(objectRecieved.socketId).emit('loginRes', objectRecieved);
  channelLoginRes.ack(response);
});

channelRegisternRes.consume(queueRegisterRes, (response) => {
  const objectRecieved = JSON.parse(response.content.toString());
  if(objectRecieved===false){
    objectRecieved={status: false, msg: "User exist"}
    console.log("user exist")
    io.to(objectRecieved.socketId).emit('registerRes', objectRecieved);
  }else{
    console.log("received in register",objectRecieved);
    io.to(objectRecieved.socketId).emit('registerRes', objectRecieved);
  }
  channelRegisternRes.ack(response);
});



channelIrrigationRes.consume(queueIrrigationRes, (response) => {
  const objectRecieved = JSON.parse(response.content.toString());
  console.log("received in irrigation",objectRecieved);
  
  io.to(objectRecieved.socketId).emit('irrigationRes', objectRecieved);
  channelIrrigationRes.ack(response);
});

channelSystemRes.consume(queueSystemRes, (response) => {
  const objectRecieved = JSON.parse(response.content.toString());
  console.log("received in system",objectRecieved);
  io.to(objectRecieved.socketId).emit('systemRes', objectRecieved);
  channelSystemRes.ack(response);
});


socket.on("identify", (idObject) => {
    listSockets[idObject.id].id = idObject.id;
    listSockets[idObject.id].module = idObject.module;
    console.log(
      listSockets[idObject.id].id,
      ":",
      listSockets[idObject.id].module
    );
  });

  socket.on("login", async (form) => {
    const queue=process.env.QUEUE_REQUEST_LOGIN;
    const objectform={
      email: form.email,
      password: form.password,
      socketId: socket.id
    }
    sendQueue(objectform, queue);
    console.log("login enviado");
  });

  socket.on("systemAsk", async (id) => {
    const queue=process.env.QUEUE_REQUEST_SYSTEM;
    const objectform={
      id: id,
      socketId: socket.id
    }
    sendQueue(objectform, queue);
    console.log("peticion enviado");
  });

  socket.on("irrigationAsk", async (id) => {
    const queue = process.env.QUEUE_REQUEST_IRRIGATION;
    const objectform={
      id: id,
      socketId: socket.id
    }
    sendQueue(objectform, queue);
    console.log("peticion enviado");
  });

  socket.on("regUser", (form) => {
    const queue = process.env.QUEUE_REQUEST_REG;
    const objectform={
      email: form.email,
      password: form.password,
      name: form.name,
      socketId: socket.id
    }
    sendQueue(objectform, queue);
    console.log("registro enviado");
  });

  socket.on("disconected", () => {
    listSockets[socket.id] = undefined;
    console.log(socket.id, "disconnected");
    socket.disconnect(true);
  });
});

const sendQueue = async (object, queue) => {
  const connected = await connect();
  const channel = await connected.createChannel(queue);
  console.log(object);
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(object)));
};

server.listen(PORT,'127.0.0.1');

console.log("Server stared on port ", PORT);
