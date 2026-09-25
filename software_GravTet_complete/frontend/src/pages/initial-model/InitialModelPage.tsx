/**
 * Initial Model page (header "Initial Model" button): spreadsheet / custom initial model editor.
 */

import InitialModelView from './InitialModelView'
import type { InitialModel } from './initialModel/types'

export default function InitialModelPage({
  content,
  initialModel,
  setInitialModel,
}: {
  content: string
  initialModel: InitialModel | null
  setInitialModel: (model: InitialModel | null) => void
}) {
  if (content !== 'initial_model') return null
  return <InitialModelView initialModel={initialModel} setInitialModel={setInitialModel} />
}
