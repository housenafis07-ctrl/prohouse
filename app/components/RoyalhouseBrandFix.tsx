'use client'

import { useEffect } from 'react'

const replaceBrand = (value: string) =>
  value.replace(/Prohouse/g, 'Royalhouse').replace(/ProHouse/g, 'RoyalHouse').replace(/PROHOUSE/g, 'ROYALHOUSE')

function updateTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current: Node | null = walker.nextNode()

  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }

  for (const node of nodes) {
    const parent = node.parentElement
    if (!parent) continue
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) continue
    if (node.nodeValue?.includes('Prohouse') || node.nodeValue?.includes('ProHouse') || node.nodeValue?.includes('PROHOUSE')) {
      node.nodeValue = replaceBrand(node.nodeValue)
    }
  }

  for (const node of nodes) {
    const value = node.nodeValue?.trim()
    if (value !== 'Pro' && value !== 'ProHouse') continue
    const next = node.nextSibling
    if (value === 'ProHouse') {
      node.nodeValue = node.nodeValue?.replace('ProHouse', 'RoyalHouse') ?? node.nodeValue
      continue
    }
    if (next?.nodeType === Node.ELEMENT_NODE) {
      const nextElement = next as Element
      if (nextElement.textContent?.trim() === 'house') {
        node.nodeValue = node.nodeValue?.replace('Pro', 'Royal') ?? node.nodeValue
      }
    } else if (next?.nodeType === Node.TEXT_NODE && next.nodeValue?.trim() === 'house') {
      node.nodeValue = node.nodeValue?.replace('Pro', 'Royal') ?? node.nodeValue
    }
  }
}

function applyRoyalhouseLogo() {
  const headerLink = document.querySelector('header a[href="/"]') as HTMLAnchorElement | null
  if (headerLink && !headerLink.dataset.royalhouseLogo) {
    headerLink.dataset.royalhouseLogo = 'true'
    headerLink.innerHTML = `
      <img src="/royalhouse-icon.svg" alt="Royalhouse" width="42" height="42" style="width:42px;height:42px;object-fit:contain;border-radius:12px;flex:none" />
      <span style="font-weight:900;letter-spacing:-0.04em">Royal<span style="color:#00c979">house</span></span>
    `
    headerLink.setAttribute('aria-label', 'Royalhouse bosh sahifa')
  }

  const footerBrand = Array.from(document.querySelectorAll('footer b')).find((el) =>
    el.textContent?.toLowerCase().includes('royalhouse')
  ) as HTMLElement | undefined
  if (footerBrand && !footerBrand.dataset.royalhouseLogo) {
    footerBrand.dataset.royalhouseLogo = 'true'
    footerBrand.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:10px">
        <img src="/royalhouse-icon.svg" alt="Royalhouse" width="32" height="32" style="width:32px;height:32px;object-fit:contain;border-radius:9px" />
        <span>Royal<span style="color:#00c979">house</span></span>
      </span>
    `
  }
}

export default function RoyalhouseBrandFix() {
  useEffect(() => {
    document.title = replaceBrand(document.title)

    const update = () => {
      updateTextNodes(document.body)
      applyRoyalhouseLogo()
    }
    update()

    const observer = new MutationObserver((mutations) => {
      let shouldUpdateLogo = false
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          shouldUpdateLogo = true
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || ''
            if (text.includes('Prohouse') || text.includes('ProHouse') || text.includes('PROHOUSE') || text.trim() === 'Pro') {
              node.nodeValue = replaceBrand(text)
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            updateTextNodes(node)
          }
        }
      }
      if (shouldUpdateLogo) applyRoyalhouseLogo()
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
