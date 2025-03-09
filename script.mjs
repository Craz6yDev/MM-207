import express from 'express';
import HTTP_CODES from './utils/httpCodes.mjs';

const server = express();
const port = (process.env.PORT || 8000);

server.set('port', port);
server.use(express.static('public'));

function getRoot(req, res, next) {
    res.status(HTTP_CODES.SUCCESS.OK).send('Hello World').end();
}

server.get("/", getRoot);

server.get("/tmp/poem", (req, res) => {
    const poem = `
        Roses are red,
        Violets are blue,
        Sugar is sweet,
        And so are you.
    `;
    res.status(HTTP_CODES.SUCCESS.OK).send(poem).end();
});

server.get("/tmp/quote", (req, res) => {
    const quotes = [
        "The only limit to our realization of tomorrow is our doubts of today. - Franklin D. Roosevelt",
        "Do what you can, with what you have, where you are. - Theodore Roosevelt",
        "The best way to predict the future is to invent it. - Alan Kay",
        "Life is 10% what happens to us and 90% how we react to it. - Charles R. Swindoll",
        "Success is not final, failure is not fatal: It is the courage to continue that counts. - Winston Churchill"
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    res.status(HTTP_CODES.SUCCESS.OK).send(randomQuote).end();
});

server.post("/tmp/sum/:a/:b", (req, res) => {
    const a = parseInt(req.params.a);
    const b = parseInt(req.params.b);
    const sum = a + b;
    res.status(HTTP_CODES.SUCCESS.OK).send(`Summen av ${a} og ${b} er ${sum}`).end();
});

server.listen(server.get('port'), function () {
    console.log('server running', server.get('port'));
});