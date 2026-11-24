const { io } = require('socket.io-client');

const socket = io('http://localhost:4000', {
  transports: ['websocket'],
  auth: {
    playerId: 'usr-bot-4800',
    username: 'Mourinho'
  }
});

let myTicketId = null;

socket.on('connect', () => {
  console.log('[Bot Connected]: socket id =', socket.id);
  joinQueue();
});

function joinQueue() {
  socket.emit('matchmaking:join', {
    variant: 'POINTS',
    entryAmount: 100,
    capacity: 2,
    pointValue: 1.25
  });
}

socket.on('matchmaking:status', (data) => {
  console.log('[Bot Status]:', data.state, data.ticket?.ticketId);
  if (data.ticket?.ticketId) {
    myTicketId = data.ticket.ticketId;
  }
});

socket.on('matchmaking:table_updated', (data) => {
  console.log('[Bot Table Updated]: status =', data.tableStatus, 'seats =', data.occupiedSeatCount);
});

socket.on('matchmaking:started', (data) => {
  console.log('[Bot Table Started!]: tableId =', data.tableId);
});

socket.on('table:state', (data) => {
  console.log('[Bot Received Table State]: dealNumber =', data.dealNumber);
});

// Periodic heartbeat
setInterval(() => {
  if (myTicketId) {
    socket.emit('matchmaking:heartbeat', { ticketId: myTicketId });
  }
}, 2000);
