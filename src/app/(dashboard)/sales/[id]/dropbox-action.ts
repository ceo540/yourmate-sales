'use server'

import { listDropboxFolder } from '@/lib/dropbox'

const DB_BASE = '/방 준영/1. 가업/★ DB'
const DB_BASE_URL = 'https://www.dropbox.com/home' + DB_BASE

export async function listSaleDropboxFiles(
  dropboxUrl: string,
): Promise<{ name: string; path: string; type: 'file' | 'folder' }[]> {
  const relativePath = dropboxUrl.replace(DB_BASE_URL, '')
  if (!relativePath || relativePath === dropboxUrl) return []
  return listDropboxFolder(relativePath)
}
