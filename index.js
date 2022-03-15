const sha512=require('sha512');
const express =  require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const MongoClient = require("mongodb").MongoClient;
const mongoClient = new MongoClient("mongodb://localhost:27017/");
const crypto = require('crypto');
const port=3000;

function checkIfOnline() {
    mongoClient.connect(function(err, client){
        const users = db.collection('users');
        users.find((err, result) => {
                if (err) {
                    return console.log(err);
                }
                if (result) {
                    result.forEach(user => {
                        users.updateOne({_id:user._id},{ sockets:user.sockets.filter(socket=>{
                            return socket.isConnected;
                        })})
                    })
                }
            });
        client.close();
    });
}

function getUpdate(chat, login, socket){
    mongoClient.connect(function(err, client){
        if(err){
            return console.log(err);
        }
        const db = client.db("messenger");
        const chats = db.collection('chats');
        chats.find({_id:chat, messages:{$elemMatch:{$where: function() {
            return !this.delivered[login]
         }}}}, function(err, result) {
            if (err) {
                msg.status='error';
                return socket.emit("getupdate", {result: 'find error', chat});
            } 
            return socket.emit("updates", result);
        });
        // взаимодействие с базой данных
        client.close();
    });
}

function notifyAll(members, db) {
    const users = db.collection('users');
    chats.find({_id:members},function(err, result){
        if (err) {
            return console.log('failed to notify '+members);
        }
        if (result) {
            result.array.forEach(user => {
                user.sockets.array.forEach(socket => {
                    socket.emit('new message', chat);
                }
                )
            });
        } 
    });
}

function subscribe(chat, login, socket) {
    mongoClient.connect(function(err, client){
        if(err){
            return console.log(err);
        }
        const db = client.db("messenger");
        const chats = db.collection('chats');
        const users = db.collection('users');
        chats.findOne({_id:chat}, function(err, result){
            if (err) {
                msg.status='error';
                return socket.emit("subscribe", {result: 'find error', chat});
            }
            if (result) {
                users.updateOne({"_id":chat},{'members':result['members'].concat(login)}, function(err1, result1) {
                    if (err) {
                        msg.status='error';
                        return socket.emit("subscribe", {result: 'update error', chat});
                        }
                    socket.emit("subscribe", {result: 'success', chat});
                });
            } 
        });
        // взаимодействие с базой данных
        client.close();
    });
}

function saveMessage(chat, msg, attachments, socket){
    mongoClient.connect(function(err, client){
        if(err){
            return console.log(err);
        }
        const db = client.db("messenger");
        const chats = db.collection('chats');
        chats.findOne({_id:chat}, function(err, result){
            if (err) {
                msg.status='error';
                return socket.emit("sendmsg", {result: 'find error', msg:msg});
            }
            if (result) {
                msg.delivered={}
                result.members.forEach(member=>{
                    msg.delivered[member]=false;
                });
                msg.status='received';
                chats.updateOne({"_id":chat},{'messages':result['messages'].concat(msg)}, function(err1, result1) {
                    if (err) {
                        msg.status='error';
                        return socket.emit("sendmsg", {result: 'update error', msg:msg});
                        }
                        notifyAll(result.members, db);
                    socket.emit("sendmsg", {result: 'success', msg:msg});
                });
            } 
        });
        // взаимодействие с базой данных
        client.close();
    });
}

function login(login, password, socket) {
    mongoClient.connect(function(err, client){
        if(err) {
            socket.emit("login", {result: 'db error'});
            return console.log(err);
        }        
        const db = client.db("messenger");
        const users = db.collection("users");
        users.findOne({_id:login}, function(err, result){
            if (err) return socket.emit("login", {result: 'find error'});
            if (result) {
                    if(sha512(result.password+result.salt+result.salt).toString('hex')===password) {
                        let cookie=sha512(crypto.randomBytes(256).toString('hex')+device+result.salt).toString('hex');
                        users.updateOne({"_id":login},{'sessions':result['sessions'].concat(sha512(cookie).toString('hex'))}, function(err1, result1) {
                            if (err) return socket.emit("login", {result: 'update error'});
                            socket.emit("login", {result: 'success', cookie});
                        });
                    } else return socket.emit("login", {result: 'notexist'});
                }
            });
        // взаимодействие с базой данных
        client.close();
    });
};

function logout(login, cookie, device, socket){
    mongoClient.connect(function(err, client){
        if(err){
            socket.emit("logout", {result: 'db error'});
            return console.log(err);
        }        
        const db = client.db("messenger");
        const collection = db.collection(user);
        users.findOne({_id:login}, function(err, result){
            if (err) return socket.emit("logout", {result: 'find error'});
            if (result) {
                let sessions=result.sessions.filter(session => session!=sha512(cookie+device+result.salt).toString('hex'));
                users.updateOne({_id:login},{sessions:sessions});
                socket.emit("logout", {result: 'success', cookie});
                }
            else return socket.emit("logout", {result: 'notexist'});
        });
        // взаимодействие с базой данных
        client.close();
    });
}

function signUp(login, password, username, avatar, phone, email, socket){
    mongoClient.connect(function(err, client){
        if(err){
            return console.log(err);
        }        
        const db = client.db("messenger");
        const collection = db.collection("users");
        collection.findOne({_id:login}, function(err, result) {
            if (err) return socket.emit('signup',{result:'error'});
            if (result) {
                socket.emit('signup',{result:'exists'});
            } else {
                let salt=crypto.randomBytes(32).toString('hex');
                collection.insertOne({_id:login,password:sha512(password+salt+salt).toString('hex'),username,avatar, phone, email, salt});
                socket.emit('signup',{result:'success'});
                login(login, password, socket);
            }
        })
        // взаимодействие с базой данных
        client.close();
    });
}

async function checkCookie(login, cookie, device, socket){
    try {
        await mongoClient.connect();
        const db = client.db("messenger");
        const users = db.collection("users");
        result = await users.findOne({_id:login});
        if (result) {
                if(sha512(cookie+device+result.salt).toString('hex')===cookie) 
                    return true;
            }
        return false;
    } catch(err){
        console.log(err);
        return false;
    } finally {
        await mongoClient.close();
    }
}

function newChat(login, login2, socket){
    mongoClient.connect(function(err, client){
        if(err){
            return console.log(err);
        }
        const db = client.db("messenger");
        const chats = db.collection('chats');
        const users = db.collection('users');
        chats.findOne({_id:[login+'-'+login2,login2+'-'+login]}, function(err, result){
            if (err) {
                return socket.emit("create chat", {result: 'find error'});
            }
            if (result) {
                return socket.emit("create chat", {result: 'already exists', resutl:result._id});
            } else {
                chats.insertOne({_id:login+'-'+login2},(err, result)=>{
                    if (err) {
                        return socket.emit("create chat", {result: 'create error', chat});
                    } 
                    return socket.emit("create chat", {result: 'success', chat: login+'-'+login2});
                })
            }
        });
        // взаимодействие с базой данных
        client.close();
    });
}


io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('send', req => {
        let body=JSON.parse(req);
        saveMessage(body['chat'], body['msg'], body['attachments'], socket);
    })

    socket.on('signup', req => {
        let body=JSON.parse(req);
        signUp(body['login'], body['password'], body['username'], body['avatar'],body['phone'], body['email'], socket);
    })

    socket.on('login', req => {
        let body=JSON.parse(req);
        login(body['login'], body['password'], socket);
    })

    socket.on('logout', req => {
        let body=JSON.parse(req);
        logout(body['login'], body['cookie'], body['device'], socket);
    })

    socket.on('subscribe', req => {
        let body=JSON.parse(req);
        subscribe(body['chat'], body['login'],  socket);
    })

    socket.on('newChat', req => {
        let body=JSON.parse(req);
        newChat(body['login1'], body['login2'],  socket);
    })
});


server.listen(port, () => {
    console.log('listening on *:'+port);
});