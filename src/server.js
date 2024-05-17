import express from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import mongoose from 'mongoose';
import socketio from 'socket.io';
import http from 'http';
import * as Notes from './controllers/note_controller';

// initialize
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // To parse the incoming requests with JSON payloads

// additional init stuff should go before hitting the routing

// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// DB Setup
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/notes';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

// add server and io initialization after app
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*', // allows requests from all incoming connections
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// START THE SERVER
// =============================================================================
async function startServer() {
  try {
    const port = process.env.PORT || 9090;
    app.listen(port);

    console.log(`Listening on port ${port}`);
  } catch (error) {
    console.error(error);
  }
}

startServer();

io.on('connection', (socket) => {
  // on first connection emit notes
  Notes.getNotes().then((result) => {
    socket.emit('notes', result);
  });

  // pushes notes to everybody
  const pushNotes = () => {
    Notes.getNotes().then((result) => {
      // broadcasts to all sockets including ourselves
      io.sockets.emit('notes', result);
    });
  };

  // creates notes and
  socket.on('createNote', (fields) => {
    Notes.createNote(fields).then((result) => {
      pushNotes();
    }).catch((error) => {
      console.log(error);
      socket.emit('error', 'create failed');
    });
  });

  socket.on('updateNote', (id, fields) => {
    Notes.updateNote(id, fields).then(() => {
      pushNotes();
    });
  });

  socket.on('deleteNote', (id) => {
    Notes.deleteNote(id).then(() => {
      pushNotes();
    }).catch((error) => {
      console.log(error);
      socket.emit('error', 'delete failed');
    });
  });
});
