export type ModuleId = 'sqs' | 's3' | 'database'

export interface ModuleMeta {
  id: ModuleId
  label: string
  icon: string
}

export const MODULES: ModuleMeta[] = [
  { id: 'sqs', label: 'SQS Explorer', icon: 'MessageSquare' },
  { id: 's3', label: 'S3 Explorer', icon: 'Folder' },
  { id: 'database', label: 'Database', icon: 'Database' },
]
