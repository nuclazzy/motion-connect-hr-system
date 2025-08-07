declare module 'jspdf' {
  export default class jsPDF {
    constructor(options?: {
      orientation?: 'portrait' | 'p' | 'landscape' | 'l'
      unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'ex' | 'em' | 'pc'
      format?: string | number[]
    })
    
    addImage(
      imageData: string | HTMLImageElement | HTMLCanvasElement,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void
    
    addPage(): void
    save(filename: string): void
    
    internal: {
      pageSize: {
        width: number
        height: number
      }
    }
  }
}

declare module 'html2canvas' {
  export default function html2canvas(
    element: HTMLElement,
    options?: {
      scale?: number
      useCORS?: boolean
      logging?: boolean
      [key: string]: any
    }
  ): Promise<HTMLCanvasElement>
}