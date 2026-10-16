/**
 * Cetak dokumen HTML lewat iframe tersembunyi (bukan window.open) sehingga tidak diblokir popup blocker.
 * Dipakai Rapor STS dan Laporan Tahsin-Tahfizh. Dialog cetak dibuka SATU kali.
 */
export function cetakDokumenHtml(html: string): void {
  const FRAME_ID = 'sdm-cetak-frame'
  let iframe = document.getElementById(FRAME_ID) as HTMLIFrameElement | null
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = FRAME_ID
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    document.body.appendChild(iframe)
  }
  const win = iframe.contentWindow
  const doc = iframe.contentDocument
  if (!win || !doc) {
    alert('Browser tidak mendukung cetak lewat iframe. Coba peramban lain.')
    return
  }
  doc.open()
  doc.write(html)
  doc.close()

  let sudah = false
  const cetak = () => {
    if (sudah) return
    sudah = true
    try {
      win.focus()
      win.print()
    } catch (e) {
      console.error(e)
      alert('Gagal membuka dialog cetak. Coba lagi.')
    }
  }
  iframe.onload = () => setTimeout(cetak, 50)
  setTimeout(cetak, 400)
}
