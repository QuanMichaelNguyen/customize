/*
  Persists the loaded video file across browser reloads using IndexedDB.
  File objects are binary-safe in IDB but cannot be stored in Zustand persist
  (which is JSON-only). This module is the bridge.
*/

const DB_NAME = 'video-editor-db'
const STORE_NAME = 'video'
const VIDEO_KEY = 'source'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveVideoFile(file: File): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(file, VIDEO_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadVideoFile(): Promise<File | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(VIDEO_KEY)
    req.onsuccess = () => resolve((req.result as File) ?? null)
    req.onerror = () => reject(req.error)
  })
}
