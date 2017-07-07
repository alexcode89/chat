var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var onlineUsers = new Array();
var app_users = {};
var app_admins = {};
var resultData ={};
var d = new Date();
app.set('port', (process.env.PORT || 5000));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
var dbConfig = {
	host     : "",
	user     : "",
	password : "",
	database : "",
	conncetionLimit : 50
};
var connectionMysql;
function reconeccionMysql(){
	connectionMysql = mysql.createConnection(dbConfig);

	connectionMysql.connect(function(err){
		if(err){
			console.log("error cuando se conectaba a la BD: ",err);
			setTimeout(reconeccionMysql,2000);
		}else{
			console.log('Base de datos conectada correctamente.')
		}
	});
	connectionMysql.on("error", function(err){
		console.log("Db error: ", err);
		if(err.code === "PROTOCOL_CONNECTION_LOST"){
			reconeccionMysql();
		}else {
			throw err;
		}
	});
}
var fecha = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index')
});
app.get('/admon', function(req, res) {
    res.render('pages/admon');
});
reconeccionMysql();
io.sockets.on('connection', function(socket){
	socket.on("app_user", function(user){
		if(user.role=="Admin"){
			app_admins[user.id] = user;
			console.log('\n\n\n\n');
			console.log("---------------")
			console.log('Administradores');
			console.log(app_admins);
			console.log('----------------');
			console.log('\n\n\n\n');
		}else{
			app_users[user.id] = user;
			console.log('\n\n\n\n');
			console.log("---------------");
			console.log('Usuarios');
			console.log(app_users);
			console.log('----------------');
			console.log('\n\n\n\n');
			io.emit("nuevo usuario", {
				id : app_users[user.id].id,
				nombre : app_users[user.id].user_name,
				role : app_users[user.id].role,
				id_dos : app_users[user.id].id_dos
			});
			connectionMysql.query("INSERT INTO tb_chat (id_chat,id_alias,fecha,nombre) VALUE ('','"+app_users[user.id].id+"','"+fecha+"','"+app_users[user.id].user_name+"')",function(error){
				if(!error){
					console.log('Se inserto el usuario correctamente.');
				}else{
					console.log('Se presento un error al insertar los datos. '+error);
				}
			});
		}
	});

	socket.on('chat message', function(msg){
		console.log(msg);
		socket.broadcast.to(msg.id_send).emit("chat message", { mensaje : msg.names+": "+msg.mensaje, id : msg.id });
		socket.emit("chat message", { mensaje : "Yo: " + msg.mensaje, id : msg.id_send });
		connectionMysql.query("INSERT INTO tb_mensajes (id_mensaje,mensaje,id_chatear) VALUE ('','"+msg.mensaje+"','"+msg.id+"')",function(error){
			if(!error){
				console.log("Se ha introducido el mensaje correctamente.");
			}else{
				console.log('Hubo un problema al guardar el mensaje.' + error);
			}
		});
	});

	socket.on("admin",function(){
	 socket.emit("admin", app_admins);
	});

	socket.on("all_users", function(){
		socket.emit("all_users", app_users);
	});

	socket.on("data",function(){
		connectionMysql.query("SELECT * FROM tb_chat",function(error,result){
			if(!error){
				var resultado = result;
				for(var i = 0, l = resultado.length, usuarios = {}; i < l; i++){
					usuarios[i] = {"nombre":resultado[i].nombre, "id": resultado[i].id_alias};
				}
				console.log(usuarios);
				socket.emit("data",usuarios);

			}else{
				console.log('Se presento un error. '+error);
			}
		});
	});

	socket.on("dataChat",function(id){
		connectionMysql.query("SELECT * FROM tb_mensajes WHERE id_chatear='"+id+"'",function(error,result){
			if(!error){
				var resultado = result;
				for(var i = 0, l = resultado.length, mensajes = {}; i < l; i++){
					mensajes[i] = {"mensaje":resultado[i].mensaje, "id": resultado[i].id_chatear};
				}
				console.log(mensajes);
				socket.emit("dataChat",mensajes);

			}else{
				console.log('Se presento un error. '+error);
			}
		});
	});

	socket.on('disconnect', function(){
		if (app_admins[socket.id]) {
			for (key in app_admins) {
				delete app_admins[key];
				delete app_admins[socket.id];
				io.emit("remove user", socket.id);
				console.log("Admin que quedan después de la desconexion: ");
				console.log(app_admins);
				console.log("\n\n\n\n");
			}
		}else{
			if (app_users[socket.id]) {
				socket.broadcast.emit("event", "Se ha desconectado un usuario");
				id_delete=app_users[socket.id].id_dos;
				for(data4 in app_admins[id_delete]){
					if(data4=="status"){
						app_admins[id_delete].status="0";
					}
				}
				delete app_users[socket.id];
				io.emit("remove user", socket.id);
				console.log("Users que quedan después de la desconexion: ");
				console.log(app_users);
				console.log("\n\n\n\n");
				console.log("Admin editados ha 0: ");
				console.log(app_admins);
				console.log("\n\n\n");
			}
		}
	});

});

http.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port')+"\n\n\n\n");
});
