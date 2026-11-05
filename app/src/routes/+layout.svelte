<script lang="ts">
  import '#lib/styles/tokens.css'
  import '#lib/styles/base.css'

  let { children } = $props()

  $effect(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => (document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light')
    sync()
    dark.addEventListener('change', sync)
    return () => dark.removeEventListener('change', sync)
  })
</script>

{@render children()}
