<script lang="ts">
  import { loadasset } from '../store/images'

  let { asset, alt = '' }: { asset?: string; alt?: string } = $props()

  let src = $state<string>()

  $effect(() => {
    let url = ''
    let gone = false
    if (asset)
      loadasset(asset).then((b) => {
        if (b && !gone) src = url = URL.createObjectURL(b)
      })
    return () => {
      gone = true
      if (url) URL.revokeObjectURL(url)
    }
  })
</script>

{#if src}<img {src} {alt} draggable="false" />{/if}
