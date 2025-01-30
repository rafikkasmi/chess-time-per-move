<script setup lang="ts">
import Board from '~/models/chess/Board';
import { useModal, useToast } from 'kneekeetah-vue-ui-kit';
import GameOverOverview from '../../molecule/GameOverOverview.vue';
import GameTimer from '../../molecule/GameTimer.vue';
import type Message from '~/types/chat/Message';
import { useRoute } from 'vue-router';
import { GameStatus, type Player } from '~/models/chess/room/ChessRoom';
import { GameOverType } from '~/types/chess/Game';
import ChessService from '~/services/chess';

const route = useRoute();
const { user } = storeToRefs(useAuth());
const { getBoard, getMovingSide, getOurSide, currGame, getOpponent, getPlayers } = storeToRefs(useGame());
const { move, setGameOver } = useGame();
const { add, open } = useModal();
const toast = useToast();

add({ id: 'game-over', component: GameOverOverview, header: 'Game over' });
await useAudio().add('notify', 'message');
await useAudio().add('game-end', 'game-end');

const emit = defineEmits<{
  (e: 'leave'): void,
  (e: 'rematch'): void,
}>();

let timerInterval: NodeJS.Timer | null = null;

// Timer update interval - updates Firestore every second for active side
function startTimerInterval() {
  if (timerInterval) return;
  
  timerInterval = setInterval(async () => {
    if (!currGame.value?.id || 
        !currGame.value.timerState || 
        currGame.value.status !== GameStatus.PROCESS) {
      return;
    }
    
    const { timerState } = currGame.value;
    if (!timerState.isFirstMovePlayed) return;

    const currentSide = getMovingSide.value;
    if (!currentSide) return;

    const timeKey = currentSide === 'white' ? 'whiteTime' : 'blackTime';
    const currentTime = timerState[timeKey];

    if (currentTime > 0) {
      console.log('Updating timer:', currentSide, currentTime - 1); // Debug log
      const newTimerState = {
        ...timerState,
        [timeKey]: currentTime - 1,
        lastMoveTime: Date.now()
      };
      await ChessService.updateTimerState(currGame.value.id, newTimerState);
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      handleTimeout(currentSide);
    }
  }, 1000);
}

// Stop timer interval
function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Watch for game status changes
watch(() => currGame.value?.status, (newStatus) => {
  if (newStatus === GameStatus.PROCESS) {
    startTimerInterval();
  } else {
    stopTimerInterval();
  }
}, { immediate: true });

async function resetTimer(side: 'white' | 'black') {
  if (!currGame.value?.timePerMove || !currGame.value.id || !currGame.value.timerState) return;
  
  const newTimerState = {
    ...currGame.value.timerState,
    [side === 'white' ? 'whiteTime' : 'blackTime']: currGame.value.timePerMove,
    lastMoveTime: Date.now()
  };
  
  await ChessService.updateTimerState(currGame.value.id, newTimerState);
}

async function onBoardUpdate(board: Board) {
  if (!currGame.value?.id) return;
  
  // Get the current moving side before the move
  const currentSide = getMovingSide.value;
  
  // Make the move
  await move(board);
  
  // Set first move as played
  if (currGame.value.timerState && !currGame.value.timerState.isFirstMovePlayed) {
    const newTimerState = {
      ...currGame.value.timerState,
      isFirstMovePlayed: true
    };
    await ChessService.updateTimerState(currGame.value.id, newTimerState);
  }
  
  // Reset the timer for the next player's turn
  if (currentSide === 'white') {
    await resetTimer('black');
  } else {
    await resetTimer('white');
  }
}

async function handleTimeout(timeoutSide: 'white' | 'black') {
  if (!currGame.value || !getPlayers.value) return;
  
  // Find the winner (the player who didn't timeout)
  const winner = getPlayers.value.find(p => p?.side !== timeoutSide) as Player;
  const loser = getPlayers.value.find(p => p?.side === timeoutSide) as Player;
  
  if (!winner || !loser) return;

  // Play timeout sound
  await useAudio().play('game-end');

  const gameOverInfo = {
    type: GameOverType.TIMEOUT,
    winner: winner,
    players: [winner, loser] as [Player, Player]
  };

  // Show timeout notification
  toast.add({
    content: `${loser.displayName}'s time has run out! Game Over!`,
    type: 'warning',
    delay: 5000
  });

  // Update the game status in Firebase
  if (currGame.value.id) {
    await ChessService.setGameOver(currGame.value.id, gameOverInfo);
    await setGameOver(); // Update local game state
  }

  // Show game over modal
  open({
    id: 'game-over',
    props: {
      gameOverInfo
    },
    emits: {
      leave: () => emit('leave'),
      rematch: () => emit('rematch'),
    }
  });
}

async function onGameOver() {
  await setGameOver();
  if (!currGame.value?.gameOverInfo) return;
  open({
    id: 'game-over',
    props: {
      gameOverInfo: currGame.value.gameOverInfo
    },
    emits: {
      leave: () => emit('leave'),
      rematch: () => emit('rematch'),
    }
  });
}

function onNewMessage(message: Message) {
  const isOur = message.createdByUid === user.value?.uid;
  if (isOur) return;
  useAudio().stop();
  useAudio().play('message');
  const toastText = `${getOpponent.value?.displayName}: ${message.content}`;
  useToast().add({ content: toastText, delay: 2000 });
}

onUnmounted(() => {
  stopTimerInterval();
});
</script>

<template>
  <div class="flex flex-col items-center w-full h-full"
    v-if="getBoard && getOurSide && currGame && currGame.id && user && user.uid">
    <ChessMoleculeOnlineHeader @leave="emit('leave')" />
    <div class="flex flex-col h-full w-full p-3 gap-3 overflow-hidden">
      <div class="flex justify-center mb-2">
        <GameTimer 
          :time-left="currGame.timerState?.[getOurSide === 'white' ? 'blackTime' : 'whiteTime'] || currGame.timePerMove" 
          :is-active="currGame.timerState?.isFirstMovePlayed && getMovingSide === (getOurSide === 'white' ? 'black' : 'white')"
          @timer-end="() => handleTimeout(getOurSide === 'white' ? 'black' : 'white')"
        />
      </div>
      <ChessTemplateBoard :disabled="getMovingSide !== getOurSide" :side="getOurSide" :board="getBoard"
        @update="onBoardUpdate" @game-over="onGameOver" />
      <div class="flex justify-center mt-2">
        <GameTimer 
          :time-left="currGame.timerState?.[getOurSide === 'white' ? 'whiteTime' : 'blackTime'] || currGame.timePerMove" 
          :is-active="currGame.timerState?.isFirstMovePlayed && getMovingSide === (getOurSide === 'white' ? 'white' : 'black')"
          @timer-end="() => handleTimeout(getOurSide === 'white' ? 'white' : 'black')"
        />
      </div>
      <ChessMoleculeOnlineFooter :game-id="currGame.id" :user-id="user.uid" @new-message="onNewMessage" />
    </div>
  </div>
</template>