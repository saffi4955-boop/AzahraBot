class TicTacToe {
  constructor(playerX = null, playerO = null) {
    this.playerX = playerX;
    this.playerO = playerO;
    this._currentTurn = false;
    this._x = 0;
    this._o = 0;
    this.turns = 0;
  }

  get currentTurn() {
    return this._currentTurn ? this.playerO : this.playerX;
  }

  get winner() {
    const patterns = [
      0b111000000,
      0b000111000,
      0b000000111,
      0b100100100,
      0b010010010,
      0b001001001,
      0b100010001,
      0b001010100
    ];

    for (const p of patterns) {
      if ((this._x & p) === p) return this.playerX;
      if ((this._o & p) === p) return this.playerO;
    }
    return null;
  }

  turn(isO, pos) {
    if (this.winner || pos < 0 || pos > 8) return -1;
    const mask = 1 << pos;
    if ((this._x | this._o) & mask) return 0;

    if (this._currentTurn) this._o |= mask;
    else this._x |= mask;

    this._currentTurn = !this._currentTurn;
    this.turns++;
    return 1;
  }

  render() {
    return [...Array(9)].map((_, i) => {
      const b = 1 << i;
      if (this._x & b) return "X";
      if (this._o & b) return "O";
      return i + 1;
    });
  }
}

module.exports = TicTacToe;
