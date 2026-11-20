<script lang="ts">
  import { app } from '../board.svelte'
  import { igembed, openlink } from '../model'

  const src = $derived(igembed(app.playing ?? ''))
  const close = () => (app.playing = null)
</script>

<svelte:window onkeydown={(e) => src && e.key === 'Escape' && close()} />

{#if src}
  <div class="shade scrim" role="presentation" onpointerdown={close}></div>
  <div class="pop player" role="dialog" aria-label="Instagram post">
    <iframe {src} title="Instagram post" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
    <div class="foot">
      <button class="q" type="button" onclick={() => openlink(app.playing!)}>Open on Instagram</button>
      <button class="q" type="button" onclick={close}>Close</button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    background: var(--scrim);
  }
  .player {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - var(--s-8)));
    height: min(820px, calc(100vh - var(--s-9)));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background: #fff;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    padding: var(--s-3);
    border-top: 1px solid var(--line);
  }
</style>
