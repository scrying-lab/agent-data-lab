import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { glideMs, useColorMode, usePrefersReducedMotion } from './media'
import type { Step, Tone } from './steps'

type StepNodeData = { num: string; label: string; tone: Tone }
type StepNode = Node<StepNodeData, 'step'>

const NODE_WIDTH = 280
const NODE_GAP = 64

/** A picture of one step. No controls inside: the step list is the keyboard path. */
function StepNodeView({ data }: NodeProps<StepNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className="trace-node__num">{data.num}</span>
      <span className="trace-node__label">{data.label}</span>
      {data.tone !== 'neutral' && <span className="trace-node__tone">{data.tone === 'ok' ? 'allowed' : data.tone}</span>}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  )
}
const nodeTypes = { step: StepNodeView }

// React Flow's built-in screen-reader hints describe dragging and deleting, which this read-only picture does not offer.
const quietLabels = {
  'node.a11yDescription.default': 'A picture of the run. Use the step list to move between steps.',
  'node.a11yDescription.keyboardDisabled': 'A picture of the run. Use the step list to move between steps.',
  'edge.a11yDescription.default': 'A picture of the run. Use the step list to move between steps.',
}

const fitOptions = { padding: 0.12, minZoom: 0.6, maxZoom: 1 }
/**
 * React Flow's corner attribution is a link to an external site: a tab stop inside a picture that
 * is meant to have none. It is hidden here and React Flow is credited in plain text under the graph.
 */
const proOptions = { hideAttribution: true }
/** The chosen step and up to two steps either side: what the graph keeps in view. */
const neighbours = (selected: number, count: number) => {
  const from = Math.max(0, Math.min(selected - 2, count - 5))
  return Array.from({ length: Math.min(5, count) }, (_, i) => ({ id: String(from + i) }))
}

type Props = { steps: Step[]; selected: number; onSelect: (index: number) => void }

/** The same steps as the list, drawn top to bottom. Visual only; clicking a node selects that step. */
export function TraceGraph({ steps, selected, onSelect }: Props) {
  const colorMode = useColorMode()
  const reducedMotion = usePrefersReducedMotion()
  const wrapper = useRef<HTMLDivElement>(null)
  const [flow, setFlow] = useState<ReactFlowInstance<StepNode, Edge> | null>(null)

  const nodes = useMemo<StepNode[]>(() => steps.map(s => ({
    id: String(s.index),
    type: 'step',
    position: { x: 0, y: s.index * NODE_GAP },
    width: NODE_WIDTH,
    data: { num: String(s.index + 1).padStart(2, '0'), label: s.label, tone: s.tone },
    className: 'trace-node trace-node--' + s.tone + (s.index === selected ? ' chosen' : ''),
    domAttributes: { 'aria-roledescription': undefined },
  })), [steps, selected])

  const edges = useMemo<Edge[]>(() => steps.slice(1).map(s => ({
    id: `to-${s.index}`,
    source: String(s.index - 1),
    target: String(s.index),
    className: 'trace-edge',
    domAttributes: { 'aria-roledescription': undefined, 'aria-hidden': true },
  })), [steps])

  // React Flow marks its wrapper as an "application", which tells screen readers to expect custom
  // keyboard handling. This picture has none, so it is presented as a labelled group instead.
  useLayoutEffect(() => { wrapper.current?.setAttribute('role', 'group') }, [])

  // Frame the chosen step with its neighbours. Under reduced motion the viewport jumps instead of gliding.
  const framed = useMemo(() => neighbours(selected, steps.length), [selected, steps.length])
  useEffect(() => {
    if (!flow) return
    void flow.fitView({ ...fitOptions, nodes: framed, duration: glideMs(reducedMotion) })
  }, [flow, framed, reducedMotion])

  return (
    <>
      <div className="trace-graph">
        <ReactFlow
          ref={wrapper}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={setFlow}
          onNodeClick={(_event, node) => onSelect(Number(node.id))}
          aria-label="Execution graph — the same steps as the step list"
          ariaLabelConfig={quietLabels}
          colorMode={colorMode}
          proOptions={proOptions}
          disableKeyboardA11y
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          nodesDraggable={false}
          nodesConnectable={false}
          autoPanOnNodeFocus={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          fitView
          fitViewOptions={{ ...fitOptions, nodes: framed, duration: 0 }}
        />
      </div>
      <p className="trace-graph-credit">Graph drawn with React Flow (MIT licence).</p>
    </>
  )
}
