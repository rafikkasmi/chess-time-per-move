<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  timeLeft: number; // Time in seconds
  isActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'timerEnd'): void
}>();

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Watch for time reaching zero
watch(() => props.timeLeft, (newValue) => {
  if (newValue === 0) {
    emit('timerEnd');
  }
});
</script>

<template>
  <div class="game-timer" :class="{ 'active': isActive }">
    <div class="time">{{ formatTime(timeLeft) }}</div>
  </div>
</template>

<style scoped>
.game-timer {
  background-color: #2c3e50;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  min-width: 100px;
  text-align: center;
}

.game-timer.active {
  background-color: #27ae60;
}

.time {
  font-family: monospace;
}
</style>
