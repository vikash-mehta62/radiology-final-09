/**
 * Selection Visual Feedback
 * 
 * Provides visual feedback for selected annotations including:
 * - Animated dashed outline
 * - Drop shadow
 * - Pulsing control points
 * - Bounding box with dimensions
 */

import type { Annotation, Point } from '../types/viewer'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

class SelectionVisualFeedback {
  private animationFrame = 0
  private dashOffset = 0
  private pulsePhase = 0
  private animationId: number | null = null

  /**
   * Start animation loop
   */
  startAnimation(): void {
    if (this.animationId !== null) return

    const animate = () => {
      this.animationFrame++
      this.dashOffset = (this.dashOffset + 1) % 20
      this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2)
      this.animationId = requestAnimationFrame(animate)
    }

    this.animationId = requestAnimationFrame(animate)
  }

  /**
   * Stop animation loop
   */
  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  /**
   * Draw selection outline with animated dashed line
   */
  drawSelectionOutline(
    ctx: CanvasRenderingContext2D,
    annotation: Annotation,
    boundingBox: BoundingBox
  ): void {
    ctx.save()

    // Draw drop shadow
    ctx.shadowColor = 'rgba(33, 150, 243, 0.5)'
    ctx.shadowBlur = 15
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Draw animated dashed outline
    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.lineDashOffset = -this.dashOffset

    // Draw outline based on annotation type
    if (annotation.type === 'rectangle') {
      ctx.strokeRect(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      )
    } else if (annotation.type === 'circle') {
      const centerX = boundingBox.x + boundingBox.width / 2
      const centerY = boundingBox.y + boundingBox.height / 2
      const radius = Math.max(boundingBox.width, boundingBox.height) / 2

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // For other types, draw outline around points
      if (annotation.points.length > 0) {
        ctx.beginPath()
        ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
        for (let i = 1; i < annotation.points.length; i++) {
          ctx.lineTo(annotation.points[i].x, annotation.points[i].y)
        }
        if (annotation.type === 'polygon') {
          ctx.closePath()
        }
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  /**
   * Draw drop shadow for selected annotation
   */
  drawDropShadow(
    ctx: CanvasRenderingContext2D,
    drawFunction: () => void
  ): void {
    ctx.save()

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    drawFunction()

    ctx.restore()
  }

  /**
   * Draw pulsing control point
   */
  drawPulsingControlPoint(
    ctx: CanvasRenderingContext2D,
    position: Point,
    baseSize: number = 8
  ): void {
    // Calculate pulse scale (1.0 to 1.3)
    const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.15
    const size = baseSize * pulseScale

    ctx.save()

    // Outer glow
    const gradient = ctx.createRadialGradient(
      position.x,
      position.y,
      0,
      position.x,
      position.y,
      size
    )
    gradient.addColorStop(0, 'rgba(33, 150, 243, 0.8)')
    gradient.addColorStop(0.5, 'rgba(33, 150, 243, 0.4)')
    gradient.addColorStop(1, 'rgba(33, 150, 243, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(position.x, position.y, size * 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Control point
    ctx.beginPath()
    ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2)

    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.restore()
  }

  /**
   * Draw selection bounding box with dimensions
   */
  drawBoundingBoxWithDimensions(
    ctx: CanvasRenderingContext2D,
    boundingBox: BoundingBox,
    pixelSpacing: number[] = [1, 1]
  ): void {
    ctx.save()

    // Draw bounding box
    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(
      boundingBox.x,
      boundingBox.y,
      boundingBox.width,
      boundingBox.height
    )

    // Calculate dimensions in mm
    const widthMm = boundingBox.width * pixelSpacing[0]
    const heightMm = boundingBox.height * pixelSpacing[1]

    // Draw dimension labels
    ctx.setLineDash([])
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Width label (top)
    this.drawDimensionLabel(
      ctx,
      `${widthMm.toFixed(1)} mm`,
      boundingBox.x + boundingBox.width / 2,
      boundingBox.y - 10
    )

    // Height label (right)
    ctx.save()
    ctx.translate(
      boundingBox.x + boundingBox.width + 10,
      boundingBox.y + boundingBox.height / 2
    )
    ctx.rotate(-Math.PI / 2)
    this.drawDimensionLabel(ctx, `${heightMm.toFixed(1)} mm`, 0, 0)
    ctx.restore()

    ctx.restore()
  }

  /**
   * Draw dimension label with background
   */
  private drawDimensionLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number
  ): void {
    const metrics = ctx.measureText(text)
    const padding = 4
    const width = metrics.width + padding * 2
    const height = 16

    // Background
    ctx.fillStyle = 'rgba(33, 150, 243, 0.9)'
    ctx.fillRect(x - width / 2, y - height / 2, width, height)

    // Border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(x - width / 2, y - height / 2, width, height)

    // Text
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, x, y)
  }

  /**
   * Draw selection handles (corner and edge)
   */
  drawSelectionHandles(
    ctx: CanvasRenderingContext2D,
    boundingBox: BoundingBox,
    handleSize: number = 8
  ): void {
    const { x, y, width, height } = boundingBox

    const handles = [
      // Corners
      { x: x, y: y, type: 'corner' },
      { x: x + width, y: y, type: 'corner' },
      { x: x, y: y + height, type: 'corner' },
      { x: x + width, y: y + height, type: 'corner' },
      // Edges
      { x: x + width / 2, y: y, type: 'edge' },
      { x: x + width / 2, y: y + height, type: 'edge' },
      { x: x, y: y + height / 2, type: 'edge' },
      { x: x + width, y: y + height / 2, type: 'edge' },
    ]

    handles.forEach((handle) => {
      this.drawHandle(ctx, handle.x, handle.y, handleSize, handle.type)
    })
  }

  /**
   * Draw individual handle
   */
  private drawHandle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: 'corner' | 'edge'
  ): void {
    ctx.save()

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 2

    if (type === 'corner') {
      // Square handle for corners
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
      ctx.strokeRect(x - size / 2, y - size / 2, size, size)
    } else {
      // Circle handle for edges
      ctx.beginPath()
      ctx.arc(x, y, size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    ctx.restore()
  }

  /**
   * Draw selection info panel
   */
  drawSelectionInfo(
    ctx: CanvasRenderingContext2D,
    annotation: Annotation,
    position: Point
  ): void {
    const name =
      annotation.metadata?.name ||
      annotation.text ||
      annotation.label ||
      'Annotation'
    const type = annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1)

    const lines = [`Type: ${type}`, `Name: ${name}`]

    ctx.save()

    // Measure text
    ctx.font = '12px Arial'
    const maxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
    const padding = 10
    const lineHeight = 16
    const width = maxWidth + padding * 2
    const height = lines.length * lineHeight + padding * 2

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(position.x, position.y, width, height)

    // Border
    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 2
    ctx.strokeRect(position.x, position.y, width, height)

    // Text
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        position.x + padding,
        position.y + padding + index * lineHeight
      )
    })

    ctx.restore()
  }

  /**
   * Get current animation frame
   */
  getAnimationFrame(): number {
    return this.animationFrame
  }

  /**
   * Get current dash offset
   */
  getDashOffset(): number {
    return this.dashOffset
  }

  /**
   * Get current pulse phase
   */
  getPulsePhase(): number {
    return this.pulsePhase
  }
}

// Singleton instance
export const selectionVisualFeedback = new SelectionVisualFeedback()
