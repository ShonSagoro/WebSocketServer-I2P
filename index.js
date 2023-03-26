import express from "express";
import morgan from "morgan";
import {Server as SocketServer} from "socket.io";
import http from "http";
import cors from "cors";
import {PORT} from "./config.js";

dotenv.config();

const hostname=process.env.HOST||'localhost';
const protocol=process.env.PROTOCOL;
const user=process.env.USER;
const password=process.env.PASSWORD;
const port=process.env.PORT;



const rabbitSettings={
    protocol: protocol,
    hostname: hostname,
    port: port,
    username: user,
    password: password
}
const connected=null;

async function connect() {
    console.log(hostname);
    try {
        connected=await amqp.connect(rabbitSettings);
        console.log('conexion exitosa');

    } catch (error) {
        console.error("Error =>", error);
    }
}

connect();


const app = express();
const server=http.createServer(app); 
const io=new SocketServer(server, {
    cors:{
        origin: ['http://127.0.0.1:5173', '']
    }
});


app.use(cors());
app.use(morgan("dev"));
const listSockets = {};
const users = [];

io.on('connection', (socket)=>{
    console.log("new user", socket.id)

    if (listSockets[socket.id] === undefined) {
        listSockets[socket.id] = {
          idSocket: socket.id,
          module: "",
          id: 0,
        };
    }

    socket.on('identify',(idObject)=>{
        listSockets[idObject.id].id=idObject.id;
        listSockets[idObject.id].module=idObject.module;
        console.log(listSockets[idObject.id].id,":",listSockets[idObject.id].module);
    })



    socket.on('login', async (form)=>{
        const queue=process.env.QUEUE_REQUEST_LOGIN;
        sendForm(form, queue)
        console.log("login enviado")
    })

    socket.on('systemAsk', async (id)=>{
        const queue=process.env.QUEUE_REQUEST_IRRIGATION;
        sendAsk(queue,id);
        console.log("peticion enviado")
    });
    
    socket.on('irrigationAsk', async (id)=>{
        const queue=process.env.QUEUE_REQUEST_IRRIGATION;
        sendAsk(queue,id);
        console.log("peticion enviado")
    });

    socket.on('updateProfile', async (form)=>{
        const queue=process.env.QUEUE_REQUEST_PROFILE;
        sendForm(form, queue)
        console.log("registro enviado")
    });
    
    socket.on('regUser', (form)=>{
        const queue=process.env.QUEUE_REQUEST_REG;
        sendForm(form, queue)
        console.log("registro enviado")
    });
  
    socket.on('disconected', ()=>{
        listSockets[socket.id] = undefined;
        console.log(socket.id, "disconnected")
        socket.disconnect(true);
    })


 
})


const sendForm=async(form, queue)=>{
    const channel=await connected.createChannel(queue);
    const messageString = JSON.stringify(form);
    channel.sendToQueue(queueLoginRequest, Buffer.from(messageString));
}
const sendAsk=async(id, queue)=>{
    const channel=await connected.createChannel(queue);
    channel.sendToQueue(queueLoginRequest, Buffer.from(id));
}


server.listen(PORT);

console.log("Server stared on port ",PORT);