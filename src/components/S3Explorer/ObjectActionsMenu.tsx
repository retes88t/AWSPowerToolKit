import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trash2, Pencil, Layers, RotateCcw } from 'lucide-react'
import { StorageClass, type StorageClass as StorageClassType } from '@aws-sdk/client-s3'
import { deleteObject, renameObject, restoreObject, setStorageClass } from '../../aws/s3Service'
import type { S3Connection } from '../../types/s3Connection'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'

const STORAGE_CLASS_OPTIONS: StorageClassType[] = [
  StorageClass.STANDARD,
  StorageClass.STANDARD_IA,
  StorageClass.ONEZONE_IA,
  StorageClass.INTELLIGENT_TIERING,
  StorageClass.GLACIER,
  StorageClass.GLACIER_IR,
  StorageClass.DEEP_ARCHIVE,
  StorageClass.REDUCED_REDUNDANCY,
]

interface ObjectActionsMenuProps {
  connection: S3Connection
  bucket: string
  objectKey: string
  currentStorageClass?: string
  onDeleted: () => void
  onRenamed: (newKey: string) => void
  onStorageClassChanged: (storageClass: string) => void
  onRestored: () => void
}

type DialogState = 'delete' | 'rename' | 'storageClass' | 'restore' | null

export function ObjectActionsMenu({
  connection,
  bucket,
  objectKey,
  currentStorageClass,
  onDeleted,
  onRenamed,
  onStorageClassChanged,
  onRestored,
}: ObjectActionsMenuProps) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const [newKey, setNewKey] = useState(objectKey)
  const [storageClass, setStorageClassValue] = useState<StorageClassType>(
    (currentStorageClass as StorageClassType) ?? StorageClass.STANDARD,
  )
  const [restoreDays, setRestoreDays] = useState(7)
  const [actionError, setActionError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => deleteObject(connection, bucket, objectKey),
    onSuccess: () => {
      setDialog(null)
      onDeleted()
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: (key: string) => renameObject(connection, bucket, objectKey, key),
    onSuccess: (_data, key) => {
      setDialog(null)
      onRenamed(key)
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const storageClassMutation = useMutation({
    mutationFn: (sc: StorageClassType) => setStorageClass(connection, bucket, objectKey, sc),
    onSuccess: (_data, sc) => {
      setDialog(null)
      onStorageClassChanged(sc)
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const restoreMutation = useMutation({
    mutationFn: (days: number) => restoreObject(connection, bucket, objectKey, days),
    onSuccess: () => {
      setDialog(null)
      onRestored()
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const isBusy =
    deleteMutation.isPending || renameMutation.isPending || storageClassMutation.isPending || restoreMutation.isPending

  function openDialog(next: DialogState) {
    setActionError(null)
    setNewKey(objectKey)
    setStorageClassValue((currentStorageClass as StorageClassType) ?? StorageClass.STANDARD)
    setRestoreDays(7)
    setDialog(next)
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => openDialog('rename')} disabled={isBusy}>
          <Pencil size={14} />
          Renombrar
        </Button>
        <Button variant="secondary" onClick={() => openDialog('storageClass')} disabled={isBusy}>
          <Layers size={14} />
          Storage class
        </Button>
        <Button variant="secondary" onClick={() => openDialog('restore')} disabled={isBusy}>
          <RotateCcw size={14} />
          Restaurar
        </Button>
        <Button variant="danger" onClick={() => openDialog('delete')} disabled={isBusy}>
          <Trash2 size={14} />
          Borrar
        </Button>
      </div>

      {dialog === 'delete' && (
        <ConfirmDialog
          title="Eliminar objeto"
          message={`¿Eliminar "${objectKey}" del bucket "${bucket}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onCancel={() => setDialog(null)}
          onConfirm={() => deleteMutation.mutate()}
        />
      )}

      {dialog === 'rename' && (
        <Modal title="Renombrar objeto" onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Nueva key</span>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            {actionError && <p className="text-xs text-red-600 dark:text-red-400">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => renameMutation.mutate(newKey)}
                disabled={!newKey || newKey === objectKey || renameMutation.isPending}
              >
                {renameMutation.isPending ? 'Renombrando…' : 'Renombrar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {dialog === 'storageClass' && (
        <Modal title="Cambiar storage class" onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Storage class</span>
              <select
                value={storageClass}
                onChange={(e) => setStorageClassValue(e.target.value as StorageClassType)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                {STORAGE_CLASS_OPTIONS.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </label>
            {actionError && <p className="text-xs text-red-600 dark:text-red-400">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => storageClassMutation.mutate(storageClass)}
                disabled={storageClassMutation.isPending}
              >
                {storageClassMutation.isPending ? 'Aplicando…' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {dialog === 'restore' && (
        <Modal title="Restaurar objeto archivado" onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Solicita una restauración temporal de "{objectKey}" (Glacier/Deep Archive). Puede tardar horas en
              completarse del lado de AWS.
            </p>
            <label className="block w-40">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Días disponible</span>
              <input
                type="number"
                min={1}
                max={30}
                value={restoreDays}
                onChange={(e) => setRestoreDays(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            {actionError && <p className="text-xs text-red-600 dark:text-red-400">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => restoreMutation.mutate(restoreDays)}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? 'Solicitando…' : 'Restaurar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
