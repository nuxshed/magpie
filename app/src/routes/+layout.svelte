<script lang="ts">
  import '#lib/styles/tokens.css'
  import '#lib/styles/base.css'
  import '#lib/styles/magpie.css'
  import '#lib/styles/app.css'
  import { dev } from '$app/env'
  import { signed } from '#lib/auth.ts'
  import Canvas from '#lib/canvas/canvas.svelte'
  import Signin from '#lib/chrome/signin.svelte'

  let { children } = $props()
  let open = $state(signed() || !!localStorage.getItem('seeded') || (dev && location.search.includes('seed')))

  $effect(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => (document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light')
    sync()
    dark.addEventListener('change', sync)
    return () => dark.removeEventListener('change', sync)
  })
</script>

{#if open}
  <Canvas />
  {@render children()}
{:else}
  <Signin onin={() => (open = true)} />
{/if}
