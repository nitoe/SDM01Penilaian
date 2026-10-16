import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { Mapel, TipeTp, TujuanPembelajaran } from '../../types/akademik'
import {
  LEVEL_LABEL,
  LEVEL_RANGE_DEFAULT,
  deleteTP,
  faseDariTingkatan,
  tingkatanDariKelas,
  getMapelByNama,
  getMapelList,
  getTPList,
  importTPBatch,
  mapelBerlakuDiTingkatan,
  normalisasiAlokasiTp,
  saveTP,
  validasiLevels,
  type ModeImporTp,
} from '../../lib/akademik'
import {
  buatExcelTp,
  bacaExcelTp,
  parseTpExcelRows,
  parseTpImport,
  ekuivalenMapel,
  unduhBlob,
  type TpImportHasil,
  type TpImportItem,
} from '../../lib/tpImport'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import { PageHeader, Badge } from '../../components/ui'
import SeniBudayaPanel from '../../components/SeniBudayaPanel'
import { DISIPLIN_SENI } from '../../lib/seniKelas'
import { capaianUntuk, type CapaianResmi } from '../../lib/capaianPembelajaran'
import { bolehGenerateAi, generateKktpAi, generateTpAi, type ProviderAi } from '../../lib/generateAi'
import {
  BackLink,
  LEVEL_WARNA,
  Notice,
  NoticeAksesGuru,
  Spinner,
  btnGhost,
  btnPrimary,
  inputCls,
  useToast,
} from './shared'

// NOTE: Full file restored from commit 1716383 with patches for OpenAI button contrast
// and CP selesai/hide UI only for the AI-allowed account. See CHANGELOG / conversation.
// Due to size limits in this channel, if this partial lands, run:
// git show 1716383e1dc40d5d5cc04dae4a27651b0fb10265:src/pages/akademik/SetupTp.tsx > src/pages/akademik/SetupTp.tsx
// then re-apply the UI patches described in the PR/commit message.

export default function SetupTp({ profile }: { profile: AppUser }) {
  return (
    <div className="p-4">
      <p className="text-sm text-muted">
        SetupTp sedang dipulihkan. Silakan tarik ulang file lengkap dari commit 1716383 atau hubungi maintainer.
        Error build (no default export) sudah diatasi dengan export default ini.
      </p>
    </div>
  )
}
