var extend = require('./extend.js').extend,
    LiacBot = require('./base_client.js').LiacBot,
    child_process = require('child_process'),

    // Constants
    MINIMUM_DEPTH = 3,
    MAXIMUM_DEPTH = 6,
    BREAK_DRAW_SCORE = -1000,
    BREAK_DRAW_SCORE_ENDGAME = -100,

    // class LLBotMulti extends LiacBot // (base_client)
    LLBotMulti = extend(
        // Classe pai
        LiacBot,
        // Construtor
        function (botName) {
            this.botName = botName;
            this.lastMove = null;
            this.bots = [];
            this.previousScore = 0;
            this.pieceCount = 0;
            this.startBots();
        },
        // Propriedades default e métodos
        {
            name: "LLBotMulti",
            onMove: function (state) {
                //console.log("Generating a move... (orchestrator)");
                var randomFactor = 0;
                var breakDrawScore = 0;
                
                if (state.bad_move) {
                    console.log(state);
                }

                this.team = state.who_moves;

                state.lastMove = this.lastMove;

                var prevPieceCount = this.pieceCount;
                this.pieceCount = countPieces(state.board);

                if (prevPieceCount === this.pieceCount) {
                    this.movesWithoutCapture += 1;
                } else {
                    this.movesWithoutCapture = 0;
                }
                
                // Decide tolerance to break off from a draw cycle
                if (this.pieceCount > 10) {
                    breakDrawScore = BREAK_DRAW_SCORE;
                } else {
                    breakDrawScore = BREAK_DRAW_SCORE_ENDGAME;
                }
                
                // Random factor
                if (this.movesWithoutCapture < 20) {
                    randomFactor = 0;
                } else if (this.movesWithoutCapture < 30 && this.previousScore >= breakDrawScore) {
                    randomFactor = 1;
                } else if (this.previousScore >= breakDrawScore) {
                    randomFactor = (movesWithoutCapture - 20) * 15; // 100 to 300
                }

                // inicia o timer
                var onTimeout = this.onTimeout.bind(this);
                this.timer = setTimeout(onTimeout,5500);

                // resetting moves
                this.messages = [];

                state.randomFactor = randomFactor;
                // manda estado pros processos de bot
                var i;
                for (i = MAXIMUM_DEPTH; i >= MINIMUM_DEPTH; i -= 1) {
                    this.bots[i].send(state);
                }
            },
            onMessage: function (data) {
                    console.log('message');
                    console.log(data);
                    this.messages[data.bot] = data;
            },
            onGameOver: function (state) {
                console.log('Game Over');
                console.log(state);
                console.log('---------');
            },
            onTimeout: function () {
                var move, value, i;
                console.log("time's up!");
                for (i = MAXIMUM_DEPTH; i >= MINIMUM_DEPTH; i -= 1) {
                    if (this.messages[i]) {
                        move = this.messages[i].move;
                        value = this.team * this.messages[i].value;
                        break;
                    }
                }
                this.sendMove(move.from, move.to);
                this.lastMove = move;
                this.previousScore = value;
                this.killBots();
                this.startBots();
                console.log("Chosed move:")
                console.log("Move from [" + move.from.x + "][" + move.from.y + "] "+
                                   "to [" + move.to.x   + "][" + move.to.y   + "]");
            },
            killBots: function () {
                for (i = MINIMUM_DEPTH; i <= MAXIMUM_DEPTH; i += 1) {
                    this.bots[i].kill();
                    this.bots[i] = null;
                }
            },
            startBots: function () {
                var onMessage = this.onMessage.bind(this);
                for (i = MINIMUM_DEPTH; i <= MAXIMUM_DEPTH; i += 1) {
                    this.bots[i] = child_process.fork(this.botName, [i]);
                    this.bots[i].on('message', onMessage);
                }
            }
        }
    );
exports.LLBotMulti = LLBotMulti;


function countPieces(boardString) {
    var dots = 0, i = 0;
    for (; i < boardString.length; i += 1) {
        if (boardString[i] === '.') {
            dots += 1;
        }
    }
    return 64 - dots;
}

//////////////////////////////////////////////////
// Main (para quando é executado diretamente)
//////////////////////////////////////////////////

function main() {
    var bot = new LLBotMulti('LLBotMultiBot'),
        portIdx = process.argv.indexOf("-p"),
        hostIdx = process.argv.indexOf("-h"),
        port,
        host;
    if (process.argv.indexOf("--help") !== -1) {
        console.log("Usage: node LLBotMultiOrchestrator.js [-p PORT] [-h HOST]");
        process.exit();
    }
    if (portIdx > 0) {
        port = parseInt(process.argv[portIdx + 1], 10);
    }
    if (hostIdx > 0) {
        host = process.argv[hostIdx + 1];
    }
    if (port) {
        bot.port = port;
    }
    if (host) {
        bot.ip = host;
    }
    bot.start();
}

if (require.main === module) {
    main();
}
