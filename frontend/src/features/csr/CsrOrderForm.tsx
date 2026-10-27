import { ArrowLeft, Save, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, DatePicker, FileUpload, FormField, Select, TextArea, TextInput } from '../../components/ui'
import { createCsrDraft, CsrRequestError, deleteCsrAttachment, downloadCsrAttachment, submitCsrOrder, updateCsrDraft, uploadCsrAttachment } from './csr-order-service'
import type { CsrOrderDetail, OrderPatch } from './csr-order-service'

type FormValues = {
  customerName: string
  destination: string
  productName: string
  productDescription: string
  orderType: string
  packagingType: string
  dimensions: string
  material: string
  printColors: string
  requestedQuantity: string
  requestedDeliveryDate: string
  technicalNotes: string
  priority: 'Normal' | 'High'
}

const requiredFields = ['customerName', 'productName', 'packagingType', 'material', 'requestedQuantity', 'requestedDeliveryDate'] as const

function initialValues(order?: CsrOrderDetail | null): FormValues {
  return {
    customerName: order?.customerName ?? '',
    destination: order?.destination ?? '',
    productName: order?.productName ?? '',
    productDescription: order?.productDescription ?? '',
    orderType: order?.orderType ?? '',
    packagingType: order?.packagingType ?? '',
    dimensions: order?.dimensions ?? '',
    material: order?.material ?? '',
    printColors: order?.printColors ?? '',
    requestedQuantity: order?.requestedQuantity?.toString() ?? '',
    requestedDeliveryDate: order?.requestedDeliveryDate ?? '',
    technicalNotes: order?.technicalNotes ?? '',
    priority: order?.priority === 'High' ? 'High' : 'Normal',
  }
}

function toPatch(values: FormValues): OrderPatch {
  return {
    ...values,
    requestedQuantity: values.requestedQuantity ? Number(values.requestedQuantity) : null,
  }
}

export function CsrOrderForm({ order, onComplete, onCancel }: { order?: CsrOrderDetail | null; onComplete: (order: CsrOrderDetail) => void; onCancel: () => void }) {
  const { showToast } = useToast()
  const [values, setValues] = useState(() => initialValues(order))
  const [files, setFiles] = useState<File[]>([])
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(order ?? null)
  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => current.filter((item) => item !== field))
  }

  function validateSubmission() {
    const missing = requiredFields.filter((field) => !values[field].trim())
    if (values.requestedQuantity && Number(values.requestedQuantity) <= 0) {
      missing.push('requestedQuantity')
    }
    setFieldErrors([...new Set(missing)])
    return missing.length === 0
  }

  async function persist(shouldSubmit: boolean) {
    if (shouldSubmit && !validateSubmission()) {
      showToast({
        title: 'Order is incomplete',
        message: 'Complete the highlighted required fields before submission.',
        tone: 'error',
      })
      return
    }

    const oversized = files.find((file) => file.size > 5 * 1024 * 1024)
    if (oversized) {
      showToast({ title: 'File is too large', message: `${oversized.name} exceeds the 5 MB limit.`, tone: 'error' })
      return
    }

    setBusy(true)
    try {
      let saved = currentOrder ? await updateCsrDraft(currentOrder.id, toPatch(values)) : await createCsrDraft(toPatch(values))
      for (const file of files) {
        saved = await uploadCsrAttachment(saved.id, file)
      }
      setCurrentOrder(saved)
      setFiles([])

      if (shouldSubmit) {
        saved = await submitCsrOrder(saved.id)
        showToast({ title: 'Order submitted', message: `${saved.orderNumber} is in R&D review.`, tone: 'success' })
      } else {
        showToast({ title: 'Draft saved', message: `${saved.orderNumber} is ready to resume later.`, tone: 'success' })
      }
      onComplete(saved)
    } catch (error) {
      if (error instanceof CsrRequestError) setFieldErrors(error.fields)
      showToast({
        title: shouldSubmit ? 'Submission failed' : 'Draft could not be saved',
        message: error instanceof Error ? error.message : 'The order request failed.',
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!currentOrder) return
    setBusy(true)
    try {
      const updated = await deleteCsrAttachment(currentOrder.id, attachmentId)
      setCurrentOrder(updated)
      showToast({ title: 'Attachment removed', tone: 'success' })
    } catch (error) {
      showToast({ title: 'Attachment could not be removed', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const editableForSubmission = !currentOrder || currentOrder.status === 'Draft'
  const fieldClass = (field: keyof FormValues) => (fieldErrors.includes(field) ? 'csr-field invalid' : 'csr-field')

  return (
    <section className="csr-form-page" aria-labelledby="csr-form-title">
      <header>
        <div>
          <p>Customer order request</p>
          <h2 id="csr-form-title">{currentOrder ? `Edit ${currentOrder.orderNumber}` : 'Create new order'}</h2>
          <span>Save an incomplete draft or complete the required fields and submit it to R&D.</span>
        </div>
        <Button className="csr-secondary-button" type="button" onClick={onCancel} disabled={busy}>
          <ArrowLeft size={17} />
          Back to orders
        </Button>
      </header>

      <form onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={busy}>
          <legend>Customer and product</legend>
          <div className="csr-form-grid">
            <FormField label="Customer name" required className={fieldClass('customerName')}>
              <TextInput value={values.customerName} onChange={(event) => update('customerName', event.target.value)} />
            </FormField>
            <FormField label="Destination" className="csr-field">
              <TextInput value={values.destination} onChange={(event) => update('destination', event.target.value)} />
            </FormField>
            <FormField label="Product name" required className={fieldClass('productName')}>
              <TextInput value={values.productName} onChange={(event) => update('productName', event.target.value)} />
            </FormField>
            <FormField label="Order type" className="csr-field">
              <TextInput value={values.orderType} onChange={(event) => update('orderType', event.target.value)} />
            </FormField>
            <FormField label="Product description" className="csr-field wide">
              <TextArea value={values.productDescription} onChange={(event) => update('productDescription', event.target.value)} />
            </FormField>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Packaging and specification</legend>
          <div className="csr-form-grid">
            <FormField label="Packaging type" required className={fieldClass('packagingType')}>
              <TextInput value={values.packagingType} onChange={(event) => update('packagingType', event.target.value)} />
            </FormField>
            <FormField label="Material" required className={fieldClass('material')}>
              <TextInput value={values.material} onChange={(event) => update('material', event.target.value)} />
            </FormField>
            <FormField label="Dimensions" className="csr-field">
              <TextInput value={values.dimensions} onChange={(event) => update('dimensions', event.target.value)} />
            </FormField>
            <FormField label="Print colors" className="csr-field">
              <TextInput value={values.printColors} onChange={(event) => update('printColors', event.target.value)} />
            </FormField>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Quantity and delivery</legend>
          <div className="csr-form-grid">
            <FormField label="Requested quantity" required className={fieldClass('requestedQuantity')}>
              <TextInput type="number" min="1" value={values.requestedQuantity} onChange={(event) => update('requestedQuantity', event.target.value)} />
            </FormField>
            <FormField label="Requested delivery date" required className={fieldClass('requestedDeliveryDate')}>
              <DatePicker value={values.requestedDeliveryDate} onChange={(event) => update('requestedDeliveryDate', event.target.value)} />
            </FormField>
            <FormField label="Priority" className="csr-field">
              <Select value={values.priority} onChange={(event) => update('priority', event.target.value as FormValues['priority'])}>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
              </Select>
            </FormField>
            <FormField label="Technical notes" className="csr-field wide">
              <TextArea value={values.technicalNotes} onChange={(event) => update('technicalNotes', event.target.value)} />
            </FormField>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Supporting files</legend>
          <FileUpload className="csr-file-control" onFilesSelected={setFiles} />
          {files.length ? (
            <ul className="csr-file-list">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  {file.name}
                  <small>{Math.ceil(file.size / 1024)} KB</small>
                </li>
              ))}
            </ul>
          ) : null}
          {currentOrder?.attachments.length ? (
            <ul className="csr-file-list existing">
              {currentOrder.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <Button variant="quiet" size="sm" type="button" onClick={() => void downloadCsrAttachment(currentOrder.id, attachment.id, attachment.fileName)}>
                    {attachment.fileName}
                  </Button>
                  <small>{Math.ceil(attachment.sizeBytes / 1024)} KB</small>
                  {currentOrder.status === 'Draft' ? (
                    <Button variant="quiet" size="sm" type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => void removeAttachment(attachment.id)}>
                      <Trash2 size={16} />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>

        <fieldset disabled={busy}>
          <legend>R&amp;D assignment</legend>
        </fieldset>

        <div className="csr-form-actions">
          <Button className="csr-secondary-button" type="button" onClick={() => void persist(false)} disabled={busy}>
            <Save size={17} />
            {busy ? 'Saving...' : 'Save draft'}
          </Button>
          {editableForSubmission ? (
            <Button variant="primary" className="csr-primary-button" type="button" onClick={() => void persist(true)} disabled={busy}>
              <Send size={17} />
              {busy ? 'Submitting...' : 'Submit for R&D review'}
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
