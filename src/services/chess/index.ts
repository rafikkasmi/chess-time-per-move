import type { Unsubscribe } from 'firebase/auth';
import { getDocumentEntity, setDocumentEntity, updateDocumentEntity, subscribeToDocumentChanges } from '~/api';
import type User from '~/models/auth/User';
import Board from '~/models/chess/Board';
import type ChessRoom from '~/models/chess/room/ChessRoom';
import { GameStatus, type Player } from '~/models/chess/room/ChessRoom';
import { generateHashCode } from '~/utils';
import { getRoomInstance } from './helpers';
import type { GameOverInfo } from '~/types/chess/Game';
import type { Color } from '~/types/chess/Color';
import type { TimerState } from '~/types/chess/TimerState';

class ChessService {
  async createChessRoom(timePerMove: number = 60) {
    const id = generateHashCode(Math.random().toString()).toString();
    const board = new Board();
    const room: ChessRoom = {
      players: [null, null],
      id,
      board: { ...board } as Board,
      status: GameStatus.NOT_STARTED,
      createdAt: new Date(),
      movingSide: 'white',
      timePerMove,
      timerState: {
        whiteTime: timePerMove,
        blackTime: timePerMove,
        lastMoveTime: Date.now(),
        isFirstMovePlayed: false
      }
    };
    await setDocumentEntity(`games/${id}`, JSON.parse(JSON.stringify(room)));
    return room;
  }
  async getChessRoom(id: string) {
    const room = await getDocumentEntity<ChessRoom>(`games/${id}`);
    if (!room) throw new Error(`Error while getting target chess room\n${id}\nDoes the room exist?`);
    return getRoomInstance(room);
  }
  async updateChessRoom(id: string, room: ChessRoom) {
    return updateDocumentEntity(`games/${id}`, room);
  }
  listenToChessRoom(id: string, callback: (room: ChessRoom) => void): Unsubscribe | undefined {
    return subscribeToDocumentChanges(`games/${id}`, (room: ChessRoom) => {
      callback(getRoomInstance(room));
    });
  }
  async joinChessRoom(id: string, initiator: User, playerSide?: Color) {
    const target = await this.getChessRoom(id);
    let side;
    const { players } = target;
    if (players.find((player) => player?.uid === initiator.uid)) return target;
    const emptyPos = players.indexOf(null);
    if (emptyPos === -1) {
      throw new Error(`Room is full already but to you are trying to connect:\n${id}\n`);
    }
    const opponent = players.find((player) => !!player);
    if (playerSide) {
      side = playerSide;
    } else {
      side = (opponent ? (opponent.side === 'white' ? 'black' : 'white') : 'white') as Color;
    }
    const player: Player = { ...initiator, side };
    target.players[emptyPos] = player;
    await this.updateChessRoom(id, target);
    return target;
  }
  async kickFromChessRoom(id: string, uid: string) {
    const target = await this.getChessRoom(id);
    target.players = target.players.map((player) => (player?.uid === uid ? null : player)) as [
      Player | null,
      Player | null
    ];
    return updateDocumentEntity(`games/${id}`, target);
  }
  async setGameOver(id: string, gameOverInfo: GameOverInfo) {
    const room = await this.getChessRoom(id);
    room.status = GameStatus.FINISHED;
    room.gameOverInfo = gameOverInfo;
    await this.updateChessRoom(id, room);
    return room;
  }
  async updateTimerState(id: string, timerState: TimerState) {
    return updateDocumentEntity(`games/${id}`, { timerState });
  }

  async resetTimer(id: string, side: Color) {
    const room = await this.getChessRoom(id);
    if (!room) return;

    const newTimerState = {
      ...room.timerState,
      lastMoveTime: Date.now(),
      [side === 'white' ? 'whiteTime' : 'blackTime']: room.timePerMove
    };

    await this.updateTimerState(id, newTimerState);
  }

  async updateTimeLeft(id: string, side: Color, timeLeft: number) {
    const room = await this.getChessRoom(id);
    if (!room) return;

    const newTimerState = {
      ...room.timerState,
      [side === 'white' ? 'whiteTime' : 'blackTime']: timeLeft
    };

    await this.updateTimerState(id, newTimerState);
  }

  async setFirstMovePlayed(id: string) {
    const room = await this.getChessRoom(id);
    if (!room) return;

    const newTimerState = {
      ...room.timerState,
      isFirstMovePlayed: true
    };

    await this.updateTimerState(id, newTimerState);
  }
}
export default new ChessService();
