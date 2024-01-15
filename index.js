const express = require('express');
const app = express();
const path = require('path');

// Store votes and session state
let votes = [];
let sessionActive = false;
let clients = [];
let participantCount = 0;
let voteCount = 0;
let participants = {};

// Generate a unique ID for each participant
const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
};


app.use(express.static('public'));

// Serve admin page
app.get('/admin', function(req, res) {
    res.sendFile(path.join(__dirname, '/public/admin.html'));
});
// Adjusted join endpoint to correctly handle new and returning participants
app.get('/join', (req, res) => {
    let participantId = req.query.id;

    if (participantId && participants[participantId] !== undefined) {
      console.log('Returning participant', participantId);
        // Existing participant, no need to increment participantCount
    } else {
        console.log('New participant');
        // New participant
        participantId = generateUniqueId();
        participants[participantId] = false; // false indicates not yet voted
        participantCount++;
    }

    sendToClients({ type: 'participantCount', data: participantCount });
    res.send(participantId);
});

// Serve participant page
app.get('/participate', function(req, res) {
    res.sendFile(path.join(__dirname, '/public/participate.html'));
});

// SSE setup
app.get('/events', function(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

function sendToClients(message) {
    clients.forEach(client =>
        client.write(`data: ${JSON.stringify(message)}\n\n`)
    );
}

// Handle vote submission with participant ID
app.get('/vote', (req, res) => {
    const { vote, id } = req.query;
    if (sessionActive && vote && id && participants[id] === false) {
        votes.push(parseInt(vote, 10));
        participants[id] = true; // mark as voted
        voteCount++;
        sendToClients({ type: 'vote', data: vote, voteCount });
    }
    res.end();
});

// Reset voteCount and participants when session starts
app.get('/start', (req, res) => {
    sessionActive = true;
    votes = [];
    voteCount = 0;
    Object.keys(participants).forEach(id => participants[id] = false);
    sendToClients({ type: 'start' });
    res.end();
});

// End voting session and send average
app.get('/end', (req, res) => {
    if (votes.length > 0) {
        const average = votes.reduce((a, b) => a + b, 0) / votes.length;
        sendToClients({ type: 'end', data: average.toFixed(2) });
    }
    sessionActive = false;
    voteCount = 0;
    Object.keys(participants).forEach(id => participants[id] = false);
  
    res.send('ok');

    res.end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
