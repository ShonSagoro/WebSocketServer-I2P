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
const queueSystemnRes = process.env.QUEUE_RESPONSE_SYSTEM;

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
const io = new SocketServer(server);

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
  const channeSystemRes = await createChannel(connection, queueSystemnRes);

  channelLoginRes.consume(queueLoginRes, (mensaje) => {
    const objectRecieved = JSON.parse(mensaje.content.toString());
    console.log("received in login",objectRecieved);
    socket.emit('loginRes',objectRecieved);
    channelLoginRes.ack(mensaje);
  });

  channelRegisternRes.consume(queueRegisterRes, (mensaje) => {
    const objectRecieved = JSON.parse(mensaje.content.toString());
    if(objectRecieved===false){
      objectRecieved={status: false, msg: "User exist"}
      console.log("user exist")
      socket.emit('registerRes',objectRecieved);
    }else{
      console.log("received in register",objectRecieved);
      socket.emit('registerRes',objectRecieved);
    }
    channelRegisternRes.ack(mensaje);
  });


  
  channelIrrigationRes.consume(queueIrrigationRes, (mensaje) => {
    const objectRecieved = JSON.parse(mensaje.content.toString());
    console.log("received in irrigation",objectRecieved);
    socket.emit('irrigationRes',objectRecieved);
    channelIrrigationRes.ack(mensaje);
  });

  channeSystemRes.consume(queueSystemnRes, (mensaje) => {
    const objectRecieved = JSON.parse(mensaje.content.toString());
    console.log("received in system",objectRecieved);
    socket.emit('systemRes',objectRecieved);
    channeSystemRes.ack(mensaje);
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
    sendQueue(form, queue);
    console.log("login enviado");
  });

  socket.on("systemAsk", async (id) => {
    const queue=process.env.QUEUE_REQUEST_SYSTEM;
    sendQueue(id, queue);
    console.log("peticion enviado");
  });

  socket.on("irrigationAsk", async (id) => {
    const queue = process.env.QUEUE_REQUEST_IRRIGATION;
    sendQueue(id, queue);
    console.log("peticion enviado");
  });

  socket.on("regUser", (form) => {
    const queue = process.env.QUEUE_REQUEST_REG;
    sendQueue(form, queue);
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

server.listen(PORT);

console.log("Server stared on port ", PORT);
