<script setup lang="ts">
import { BaseCheckbox, BaseButton, useModal, BaseLoader, BaseInput } from 'kneekeetah-vue-ui-kit';
const { create, join } = useGame();
const { close } = useModal();
const loading = ref(false);
const form = ref({
  isBlack: false,
  timePerMove: 60, // Default 60 seconds per move
});

const validateTime = (value: number) => {
  return value >= 10 && value <= 600; // Between 10 seconds and 10 minutes
};

async function createGame() {
  if (!validateTime(form.value.timePerMove)) {
    alert('Time per move must be between 10 seconds and 10 minutes');
    return;
  }
  loading.value = true;
  const { id } = await create(form.value.timePerMove);
  await join(id, form.value.isBlack ? 'black' : 'white');
  await useRouter().push({
    name: 'game-id',
    params: { id: id },
  });
  loading.value = false;
  close();
}
</script>
<template>
  <div class="flex flex-col w-full gap-4 text-gray-300">
    <div class="flex justify-between items-center">
      <p>Play as black</p>
      <BaseCheckbox v-model="form.isBlack" />
    </div>
    <div class="flex justify-between items-center">
      <p>Time per move (seconds)</p>
      <BaseInput 
        type="number" 
        v-model="form.timePerMove" 
        :min="1"
        :max="600"
        class="w-24 text-right"
      />
    </div>
    <BaseButton rounded @click="createGame">
      <BaseLoader v-if="loading" color="white"></BaseLoader>
      <p v-else>Create</p>
    </BaseButton>
  </div>
</template>