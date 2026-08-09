import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import mountainIllustration from './assets/mountain.png'
import seaIllustration from './assets/sea.png'
import cityIllustration from './assets/city.png'
import { createSupabaseClient } from './lib/supabase'

type Screen = '入力' | '履歴' | '精算' | '明細'
type SplitMode = '割り勘' | '男気' | '先輩'
type Destination = '街' | '海' | '山'
type HistoryEntry = { title: string; paidBy: string; beneficiary: string[]; amount: number; returners: string[]; mode: SplitMode }

const destinationIllustrations: Record<Destination, string> = { 山: mountainIllustration, 海: seaIllustration, 街: cityIllustration }

const people = [
  { name: 'あやちゃ', color: 'pink', initial: 'あ' },
  { name: 'はるか', color: 'blue', initial: 'は' },
  { name: 'こどみ', color: 'yellow', initial: 'こ' },
]

const yen = (n: number) => new Intl.NumberFormat('ja-JP').format(n)

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const person = people.find((p) => p.name === name) ?? people[0]
  return <span className={`avatar ${person.color} ${small ? 'small' : ''}`} aria-label={name}>{name.slice(0, 1)}</span>
}

function App() {
  const [screen, setScreen] = useState<Screen>('入力')
  const [amount, setAmount] = useState('')
  const [item, setItem] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [beneficiary, setBeneficiary] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMode>('割り勘')
  const [setupComplete, setSetupComplete] = useState(false)
  const [shareReady, setShareReady] = useState(false)
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [registeredMembers, setRegisteredMembers] = useState<string[]>([])
  const [records, setRecords] = useState<HistoryEntry[]>([])
  const [completedTransfers, setCompletedTransfers] = useState<string[]>([])
  const [allPaidCelebrated, setAllPaidCelebrated] = useState(false)
  const [destination, setDestination] = useState<Destination>('街')
  const [destinationMenuOpen, setDestinationMenuOpen] = useState(false)
  const groupId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const existing = params.get('group')
    if (existing) return existing
    const created = crypto.randomUUID()
    params.set('group', created)
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
    return created
  }, [])
  const supabase = useMemo(() => createSupabaseClient(groupId), [groupId])
  const activeMembers = registeredMembers.length > 0 ? registeredMembers : people.map((person) => person.name)
  const total = useMemo(() => records.reduce((sum, entry) => sum + entry.amount, 0), [records])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const load = async () => {
      const [{ data: memberRows, error: memberError }, { data: expenseRows, error: expenseError }] = await Promise.all([
        client.from('members').select('name').eq('group_id', groupId).order('created_at'),
        client.from('expenses').select('*').eq('group_id', groupId).order('created_at'),
      ])
      if (memberError || expenseError) console.error('Flowari sync error', memberError ?? expenseError)
      if (memberRows?.length) {
        const names = memberRows.map((row) => row.name as string)
        setRegisteredMembers(names)
        setPaidBy((current) => current || names[0])
        setBeneficiary((current) => current.length ? current : names)
        setSetupComplete(true)
      }
      if (expenseRows) {
        setRecords(expenseRows.map((row) => ({ title: row.title, paidBy: row.paid_by, beneficiary: row.beneficiary as string[], amount: Number(row.amount), returners: row.mode === '男気' ? [] : (row.beneficiary as string[]).filter((name) => name !== row.paid_by), mode: row.mode })))
      }
    }
    void load()
    const channel = client.channel(`flowari-${groupId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () => { void load() }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [groupId])

  return (
    <div className={`site-shell theme-${destination}`}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Flowari ホーム"><span>◌</span> Flowari</a>
        <p>立替・返金が迷わない割り勘アプリ</p>
      </header>

      <main id="top" className="main-layout">
        <section className="intro">
          <span className="eyebrow">GROUP EXPENSES, SIMPLIFIED</span>
          <h1>誰が立替え、<br /><em>誰が返すか。</em></h1>
          <p>支払い履歴から返金の順番まで。グループのお金の流れを、ひと目で確かめられます。</p>
          <div className="members">
            {people.map((person) => <div className="member" key={person.name}><Avatar name={person.name} /><span>{person.name}</span></div>)}
          </div>
          <div className="stats"><div><b>¥{yen(total)}</b><span>今回の合計</span></div><div><b>{setupComplete ? `${activeMembers.length} 人` : '未登録'}</b><span>メンバー</span></div><div><b>{records.length} 件</b><span>立替履歴</span></div></div>
        </section>

        <section className="phone" aria-label="Flowariのアプリ画面">
          {setupComplete && <button className="share-header-button" onClick={() => setShowShareScreen(true)}>共有URL</button>}
          {showShareScreen && <div className="share-overlay"><ShareScreen groupId={groupId} onContinue={() => setShowShareScreen(false)} /></div>}
          <div className="app-header"><button className="mascot destination-trigger" onClick={() => setDestinationMenuOpen((current) => !current)} aria-label="行先テーマを選ぶ" aria-expanded={destinationMenuOpen}>◌</button><div><b>Flowari</b><small>{setupComplete ? 'なかよく、すっきり精算' : 'はじめる準備'}</small></div></div>
          {destinationMenuOpen && <div className="destination-menu" role="dialog" aria-label="行先を選ぶ"><p>行先を選ぶ</p><div>{(['山', '海', '街'] as Destination[]).map((place) => <button key={place} className={destination === place ? 'selected' : ''} onClick={() => { setDestination(place); setDestinationMenuOpen(false) }}><img src={destinationIllustrations[place]} alt="" />{place}</button>)}</div></div>}
          {!setupComplete ? (shareReady ? <ShareScreen groupId={groupId} onContinue={() => setSetupComplete(true)} /> : <SetupScreen destination={destination} onComplete={(members) => { setRegisteredMembers(members); setPaidBy(members[0]); setBeneficiary(members); setShareReady(true); if (supabase) void (async () => { await supabase.from('groups').upsert({ id: groupId, name: 'Flowariグループ' }); await supabase.from('members').insert(members.map((name) => ({ group_id: groupId, name }))) })() }} />) : <>
          <nav className="tabs" aria-label="画面切り替え">
            {(['入力', '履歴', '精算', '明細'] as Screen[]).map((name) => <button key={name} className={screen === name ? 'active' : ''} onClick={() => setScreen(name)}>{name}</button>)}
          </nav>

          <div className="screen-content">
            {syncError && <div className="sync-error">共有データの保存に失敗しました：{syncError}</div>}
            {screen === '入力' && <InputScreen members={activeMembers} item={item} amount={amount} paidBy={paidBy} beneficiary={beneficiary} splitMode={splitMode} submitted={submitted} setItem={setItem} setAmount={setAmount} setPaidBy={setPaidBy} setBeneficiary={setBeneficiary} setSplitMode={setSplitMode} onEdited={() => { setSubmitted(false); setSyncError('') }} onSubmit={() => { const value = Number(amount); if (item.trim() && value > 0 && beneficiary.length > 0) { const next = { title: item.trim(), paidBy, beneficiary, amount: value, returners: splitMode === '男気' ? [] : beneficiary.filter((name) => name !== paidBy), mode: splitMode }; setRecords((current) => [...current, next]); if (supabase) void supabase.from('expenses').insert({ group_id: groupId, title: next.title, amount: next.amount, paid_by: next.paidBy, beneficiary: next.beneficiary, mode: next.mode }).then(({ error }) => { if (error) { setSyncError(error.message); console.error('Flowari save error', error) } }, (error: unknown) => { setSyncError(error instanceof Error ? error.message : '通信エラー') }); setSubmitted(true); setScreen('履歴') } }} />}
            {screen === '履歴' && <HistoryScreen entries={records} members={activeMembers} onDelete={(index) => { setRecords((current) => current.filter((_, entryIndex) => entryIndex !== index)); setCompletedTransfers([]); setAllPaidCelebrated(false) }} />}
            {screen === '精算' && <SettlementScreen members={activeMembers} entries={records} completedTransfers={completedTransfers} setCompletedTransfers={setCompletedTransfers} allPaidCelebrated={allPaidCelebrated} setAllPaidCelebrated={setAllPaidCelebrated} />}
            {screen === '明細' && <DetailsScreen entries={records} />}
          </div>
          </>}
        </section>
      </main>
    </div>
  )
}

function SetupScreen({ destination, onComplete }: { destination: Destination; onComplete: (members: string[]) => void }) {
  const [members, setMembers] = useState<string[]>([])
  const [name, setName] = useState('')
  const add = () => {
    const trimmed = name.trim()
    if (trimmed && !members.includes(trimmed)) {
      setMembers([...members, trimmed])
      setName('')
    }
  }
  return <section className="setup-screen">
    <div className="setup-destination-illustration"><img src={destinationIllustrations[destination]} alt={`${destination}のイラスト`} /></div>
    <p className="eyebrow">WELCOME</p>
    <h2>まずはメンバーを登録</h2>
    <p className="setup-copy">立替えた人と返す人をわかりやすくするため、グループのメンバーを追加します。</p>
    <div className="add-person"><input aria-label="メンバー名" placeholder="名前を入力" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} /><button onClick={add}>追加</button></div>
    <div className="setup-members">{members.length === 0 ? <p>まだメンバーがいません</p> : members.map((member) => <span key={member}><Avatar name={member} small />{member}<button aria-label={`${member}を削除`} onClick={() => setMembers(members.filter((item) => item !== member))}>×</button></span>)}</div>
    <button className="primary-button setup-button" disabled={members.length < 2} onClick={() => onComplete(members)}>{members.length < 2 ? 'あと1人追加してください' : `${members.length}人でグループをはじめる →`}</button>
  </section>
}

function InputScreen(props: { members: string[]; item: string; amount: string; paidBy: string; beneficiary: string[]; splitMode: SplitMode; submitted: boolean; setItem: (v: string) => void; setAmount: (v: string) => void; setPaidBy: (v: string) => void; setBeneficiary: (v: string[]) => void; setSplitMode: (v: SplitMode) => void; onEdited: () => void; onSubmit: () => void }) {
  const value = Number(props.amount || 0)
  const count = props.members.length
  const beneficiaryCount = props.beneficiary.length
  const seniorPayers = props.beneficiary.filter((name) => name !== props.paidBy)
  const perPerson = props.splitMode === '割り勘' ? Math.round(value / Math.max(beneficiaryCount, 1)) : props.splitMode === '男気' ? 0 : Math.round((value / 2) / Math.max(seniorPayers.length, 1))
  const modeCopy: Record<SplitMode, string> = { '割り勘': `${beneficiaryCount}人で均等に割り勘`, '男気': '立替えた人が全額負担', '先輩': '先輩が半額分を支払う' }
  return <>
    <div className="screen-title"><span className="title-icon">＋</span><div><small>NEW EXPENSE</small><h2>立替を登録</h2></div></div>
    <label>何に使った？<input value={props.item} onChange={(e) => { props.setItem(e.target.value); props.onEdited() }} /></label>
    <label>金額 <div className="money-input"><span>¥</span><input inputMode="numeric" value={props.amount} onChange={(e) => { props.setAmount(e.target.value.replace(/\D/g, '')); props.onEdited() }} /></div></label>
    <p className="field-label">立替えた人</p><div className="person-picker">{props.members.map((name) => <button key={name} className={props.paidBy === name ? 'chosen' : ''} onClick={() => { props.setPaidBy(name); props.onEdited() }}><Avatar name={name} small /><span>{name}</span></button>)}</div>
    <p className="field-label">対象者</p><div className="person-picker beneficiary-picker">{props.members.map((name) => <button key={name} className={props.beneficiary.includes(name) ? 'chosen' : ''} onClick={() => { props.setBeneficiary(props.beneficiary.includes(name) ? props.beneficiary.filter((member) => member !== name) : [...props.beneficiary, name]); props.onEdited() }}><Avatar name={name} small /><span>{name}</span></button>)}</div>
    <p className="field-label">割り勘モード</p><div className="mode-picker">{(['割り勘', '男気', '先輩'] as SplitMode[]).map((mode) => <button key={mode} className={props.splitMode === mode ? 'chosen' : ''} onClick={() => { props.setSplitMode(mode); props.onEdited() }}>{mode}</button>)}</div>
    <div className="split-note"><span>{props.splitMode === '割り勘' ? '÷' : <i className={`mode-badge ${props.splitMode === '男気' ? 'mode-badge-boldstar' : 'mode-badge-sparkle'}`} aria-hidden="true">{props.splitMode === '男気' ? '★' : '✦'}</i>}</span><p><b>{modeCopy[props.splitMode]}</b><br />{props.splitMode === '男気' ? '返金は発生しません' : `ひとりあたり ¥${yen(perPerson)}`}</p></div>
    <button className="primary-button" onClick={props.onSubmit}>{props.submitted ? '登録しました ✓' : '立替を登録する'}</button>
  </>
}

function HistoryScreen({ entries, members, onDelete }: { entries: HistoryEntry[]; members: string[]; onDelete: (index: number) => void }) {
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [])
  return <><HistoryFlow members={members} entries={entries} />
    <div className="screen-title history-title"><span className="title-icon">◷</span><div><small>EXPENSE HISTORY</small><h2>会計履歴 <i>{entries.length}件</i></h2></div></div>
    <div className="history-list">{entries.length === 0 ? <div className="empty-state"><span>◷</span><b>まだ立替履歴はありません</b><p>「入力」から最初の立替を登録しましょう。</p></div> : entries.map((entry, index) => <article className="history-card" key={`${entry.title}-${entry.amount}-${index}`}><div className="history-head"><div><b>{entry.title}</b><p><Avatar name={entry.paidBy} small /> {entry.paidBy} が <strong>¥{yen(entry.amount)}</strong> 立替え <i className="mode-tag">{entry.mode}</i></p><small className="beneficiary-line">対象：{entry.beneficiary.map((name) => <span key={name}><Avatar name={name} small /> {name}</span>)}</small></div><div className="history-actions" ref={openMenu === index ? menuRef : undefined}><button className="history-menu-button" aria-label={`${entry.title}の操作`} aria-expanded={openMenu === index} onClick={() => setOpenMenu((current) => current === index ? null : index)}>···</button>{openMenu === index && <button className="delete-history-button" onClick={() => { onDelete(index); setOpenMenu(null) }}>消去</button>}</div></div>{entry.returners.length === 0 ? <div className="repayment no-return"><i className="mode-badge mode-badge-boldstar" aria-hidden="true">★</i>返金なし（男気モード）</div> : <div className="repayment"><div className="returners">{entry.returners.map((name) => <Avatar name={name} small key={name} />)}</div><span className="arrow">→</span><Avatar name={entry.paidBy} small /><span className="repayment-text">返金する ¥{yen(Math.round(repaymentAmount(entry, members.length)))}</span></div>}</article>)}</div>
  </>
}

function HistoryFlow({ members, entries }: { members: string[]; entries: HistoryEntry[] }) {
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null)
  const positions = members.map((name, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / members.length
    return { name, angle, x: 50 + Math.cos(angle) * 36, y: 50 + Math.sin(angle) * 36 }
  })
  const flows = entries.flatMap((entry, entryIndex) => entry.returners.map((sender, returnerIndex) => ({
    sender,
    receiver: entry.paidBy,
    amount: repaymentAmount(entry, members.length),
    title: entry.title,
    beneficiary: entry.beneficiary,
    index: entryIndex * Math.max(entry.returners.length, 1) + returnerIndex,
  })))
  const routes = Array.from(flows.reduce((grouped, flow) => {
    const key = `${flow.sender}→${flow.receiver}`
    const route = grouped.get(key) ?? { sender: flow.sender, receiver: flow.receiver, transactions: [] as typeof flows }
    route.transactions.push(flow)
    grouped.set(key, route)
    return grouped
  }, new Map<string, { sender: string; receiver: string; transactions: typeof flows }>()).values()).slice(0, members.length * 2)
  const findPosition = (name: string) => positions.find((position) => position.name === name) ?? positions[0]
  const routeLayouts = routes.map((route, routeIndex) => {
    const from = findPosition(route.sender)
    const to = findPosition(route.receiver)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.hypot(dx, dy) || 1
    const senderIndex = members.indexOf(route.sender)
    const receiverIndex = members.indexOf(route.receiver)
    const clockwiseSteps = (receiverIndex - senderIndex + members.length) % members.length
    const isClockwise = clockwiseSteps > 0 && clockwiseSteps <= members.length / 2
    const normalX = -dy / distance
    const normalY = dx / distance
    const midpointX = (from.x + to.x) / 2
    const midpointY = (from.y + to.y) / 2
    const normalPointsInward = normalX * (50 - midpointX) + normalY * (50 - midpointY) >= 0
    const inwardX = normalPointsInward ? normalX : -normalX
    const inwardY = normalPointsInward ? normalY : -normalY
    const side = isClockwise ? -1 : 1
    const trim = 6.2
    const lineOffset = side * 3.4
    const labelDistance = side * 13
    return { route, routeIndex, key: `${route.sender}→${route.receiver}`, dx, dy, distance, midpointX, midpointY, inwardX, inwardY, lineOffset, labelDistance, startX: from.x + (dx / distance) * trim + inwardX * lineOffset, startY: from.y + (dy / distance) * trim + inwardY * lineOffset, endX: to.x - (dx / distance) * trim + inwardX * lineOffset, endY: to.y - (dy / distance) * trim + inwardY * lineOffset }
  })
  const labelLayouts = routeLayouts.map((layout) => ({
    layout,
    x: layout.midpointX + layout.inwardX * layout.lineOffset,
    y: layout.midpointY + layout.inwardY * layout.lineOffset,
  }))
  const selectedRoute = routeLayouts.find((layout) => layout.key === selectedRouteKey)
  return <section className="history-flow-panel" aria-label="履歴のお金の流れ">
    <div className="history-flow-heading"><div><small>ALL HISTORY FLOW</small><h3>履歴のやり取り</h3></div></div>
    {flows.length === 0 ? <p className="flow-empty">返金が発生する履歴を追加すると、ここにお金の流れを表示します。</p> : <div className="history-flow-diagram">
      <svg className="flow-lines" viewBox="0 0 100 100" aria-hidden="true">
        <defs><marker id="history-flow-arrow" markerWidth="3.2" markerHeight="3.2" refX="3" refY="1.6" orient="auto"><path d="M0,0 L3.2,1.6 L0,3.2 Z" /></marker></defs>
        {routeLayouts.map((layout) => <path className="history-flow-path" key={`${layout.route.sender}-${layout.route.receiver}`} d={`M ${layout.startX} ${layout.startY} L ${layout.endX} ${layout.endY}`} markerEnd="url(#history-flow-arrow)" />)}
        {labelLayouts.map(({ layout, x, y }) => {
          const label = `¥${yen(Math.round(layout.route.transactions.reduce((sum, transaction) => sum + transaction.amount, 0)))}`
          const labelWidth = 11.9
          return <g className="history-flow-label" key={layout.key} role="button" tabIndex={0} aria-label={`${layout.route.sender}から${layout.route.receiver}への内訳を表示`} onClick={() => setSelectedRouteKey(layout.key)} onKeyDown={(event) => event.key === 'Enter' && setSelectedRouteKey(layout.key)}><rect className="history-flow-label-bg" x={x - labelWidth / 2} y={y - 2.38} width={labelWidth} height="4.76" rx="2.38" /><text className="history-flow-amount" x={x} y={y}>{label}</text></g>
        })}
      </svg>
      {positions.map((position) => <div className="history-flow-person" key={position.name} style={{ left: `${position.x}%`, top: `${position.y}%`, '--label-x': `${Math.cos(position.angle) * 42}px`, '--label-y': `${Math.sin(position.angle) * 42}px` } as CSSProperties}><Avatar name={position.name} /><b>{position.name}</b></div>)}
    </div>}{selectedRoute && <div className="flow-breakdown" role="dialog" aria-label="金額の内訳"><div><span>{selectedRoute.route.sender} → {selectedRoute.route.receiver}</span><button onClick={() => setSelectedRouteKey(null)} aria-label="内訳を閉じる">×</button></div><b>¥{yen(Math.round(selectedRoute.route.transactions.reduce((sum, transaction) => sum + transaction.amount, 0)))}</b><ul>{selectedRoute.route.transactions.map((transaction) => <li key={`${transaction.title}-${transaction.index}`}><span>{transaction.title}</span><strong>¥{yen(Math.round(transaction.amount))}</strong></li>)}</ul></div>}
  </section>
}

function SettlementScreen({ members, entries, completedTransfers, setCompletedTransfers, allPaidCelebrated, setAllPaidCelebrated }: { members: string[]; entries: HistoryEntry[]; completedTransfers: string[]; setCompletedTransfers: Dispatch<SetStateAction<string[]>>; allPaidCelebrated: boolean; setAllPaidCelebrated: Dispatch<SetStateAction<boolean>> }) {
  const [celebratingTransfer, setCelebratingTransfer] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const balances = members.map((name) => ({ name, value: entries.reduce((sum, entry) => sum + (entry.paidBy === name ? entry.amount : 0) - shareFor(entry, name, members.length), 0) }))
  const credits = balances.filter((balance) => balance.value > 1).map((balance) => ({ ...balance }))
  const debts = balances.filter((balance) => balance.value < -1).map((balance) => ({ ...balance }))
  const transfers: { sender: string; receiver: string; amount: number }[] = []
  let creditIndex = 0
  let debtIndex = 0
  while (creditIndex < credits.length && debtIndex < debts.length) {
    const credit = credits[creditIndex]
    const debt = debts[debtIndex]
    const amount = Math.min(credit.value, -debt.value)
    transfers.push({ sender: debt.name, receiver: credit.name, amount })
    credit.value -= amount
    debt.value += amount
    if (credit.value < 1) creditIndex += 1
    if (debt.value > -1) debtIndex += 1
  }
  const allComplete = transfers.length > 0 && transfers.every((transfer, index) => completedTransfers.includes(`${transfer.sender}-${transfer.receiver}-${index}`))
  useEffect(() => {
    if (!allComplete) {
      if (allPaidCelebrated) setAllPaidCelebrated(false)
      return
    }
    if (allPaidCelebrated) return
    setAllPaidCelebrated(true)
    setShowConfetti(true)
    const timer = window.setTimeout(() => setShowConfetti(false), 2800)
    return () => window.clearTimeout(timer)
  }, [allComplete])
  if (entries.length === 0 || transfers.length === 0) return <><div className="screen-title"><span className="title-icon">↗</span><div><small>SETTLEMENT</small><h2>精算結果</h2></div></div><div className="empty-state"><span>◎</span><b>精算するデータがありません</b><p>立替を登録すると、最短の返金フローを表示します。</p></div></>
  return <>{showConfetti && <div className="settlement-confetti" aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 8) * 75}ms`, animationDuration: `${1900 + (index % 5) * 180}ms` }} />)}</div>}<div className="screen-title"><span className="title-icon">↗</span><div><small>SETTLEMENT</small><h2>精算結果</h2></div></div>
    <div className="settlement-summary"><p>すべての差額を<br /><b>最少の送金回数で精算できます</b></p><span>{transfers.length} 回</span></div>
    {transfers.map((transfer, index) => {
      const transferId = `${transfer.sender}-${transfer.receiver}-${index}`
      const isCelebrating = celebratingTransfer === transferId
      const isComplete = completedTransfers.includes(transferId)
      const celebrate = () => {
        setCelebratingTransfer(null)
        window.requestAnimationFrame(() => setCelebratingTransfer(transferId))
      }
      return <div className={`payment-card ${index > 0 ? 'compact' : ''} ${isCelebrating ? 'is-sending' : ''} ${isComplete ? 'is-complete' : ''}`} key={transferId}><div className="people-flow"><span className="flow-arrow" aria-hidden="true" /><Avatar name={transfer.sender} />{!isComplete && <button className="coin-stack coin-button" onClick={celebrate} aria-label={`¥${yen(Math.round(transfer.amount))}を支払い完了にする`} onAnimationEnd={() => { if (isCelebrating) { setCompletedTransfers((current) => current.includes(transferId) ? current : [...current, transferId]); setCelebratingTransfer(null) } }}><span className="coin-amount">¥{yen(Math.round(transfer.amount))}</span></button>}<Avatar name={transfer.receiver} /></div><div className="names"><b>{transfer.sender}</b><b>{transfer.receiver}</b></div>{isComplete && <button className="complete-label" onClick={() => setCompletedTransfers((current) => current.filter((id) => id !== transferId))}>支払い完了</button>}</div>
    })}
    <a className="batch-pay-button" href="https://paypay.ne.jp/app/" target="_blank" rel="noreferrer">PayPayアプリを開いて送金する ↗</a>
  </>
}

function DetailsScreen({ entries }: { entries: HistoryEntry[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  return <><div className="screen-title"><span className="title-icon">≡</span><div><small>GROUP BALANCE</small><h2>みんなの明細</h2></div></div>
    <div className="total-card"><small>グループ支出合計</small><b>¥{yen(total)}</b><span>登録した立替 {entries.length}件</span></div>
    <DailyExpenses members={Array.from(new Set(entries.flatMap((entry) => [entry.paidBy, ...entry.beneficiary])))} entries={entries} />
    <div className="detail-tip"><span>◎</span><p><b>差額は精算画面でまとめて解決</b><br />誰が誰に払うか、最短ルートで案内します。</p></div>
  </>
}

function ShareScreen({ groupId, onContinue }: { groupId: string; onContinue: () => void }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}${window.location.pathname}?group=${groupId}`
  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
  }
  return <section className="setup-screen share-screen">
    <div className="share-icon" aria-hidden="true">↗</div>
    <p className="eyebrow">SHARE YOUR GROUP</p>
    <h2>グループを共有しよう</h2>
    <p className="setup-copy">このURLをみんなに送ると、同じメンバーと履歴を一緒に編集できます。</p>
    <div className="share-url">{shareUrl}</div>
    <button className="primary-button" onClick={copy}>{copied ? 'コピーしました ✓' : '共有URLをコピー'}</button>
    <button className="share-continue" onClick={onContinue}>Flowariをはじめる →</button>
  </section>
}

function DailyExpenses({ members, entries }: { members: string[]; entries: HistoryEntry[] }) {
  return <section className="daily-expenses"><div className="daily-expenses-heading"><div><small>TODAY'S EXPENSES</small><h3>みんなの今日の出費</h3></div><span>{members.length}人</span></div><div className="daily-expense-list">{members.map((name) => { const amount = entries.reduce((sum, entry) => sum + personalExpenseFor(entry, name), 0); const isBold = entries.some((entry) => entry.mode === '男気' && entry.paidBy === name); const isSenior = entries.some((entry) => entry.mode === '先輩' && entry.paidBy === name); return <div className="daily-expense-person" key={name}><div className="daily-avatar-wrap">{isBold && <span className="mode-badge mode-badge-boldstar daily-mode-star" aria-hidden="true">★</span>}<Avatar name={name} /></div><b className="daily-expense-name">{name}{isSenior && <span className="mode-stars" aria-hidden="true">✦ ˚</span>}</b><strong>¥{yen(Math.round(amount))}</strong></div> })}</div></section>
}

function shareFor(entry: HistoryEntry, name: string, count: number) {
  const beneficiaryCount = Math.max(entry.beneficiary.length, 1)
  if (entry.mode === '男気') return name === entry.paidBy ? entry.amount : 0
  if (entry.mode === '先輩') return name === entry.paidBy ? entry.amount / 2 : entry.beneficiary.includes(name) ? entry.amount / (beneficiaryCount * 2) : 0
  return entry.beneficiary.includes(name) ? entry.amount / beneficiaryCount : 0
}

function repaymentAmount(entry: HistoryEntry, count: number) {
  if (entry.mode === '男気') return 0
  if (entry.mode === '先輩') return entry.amount / Math.max(entry.beneficiary.filter((name) => name !== entry.paidBy).length * 2, 1)
  return entry.amount / Math.max(entry.beneficiary.length, 1)
}

function personalExpenseFor(entry: HistoryEntry, name: string) {
  const beneficiaryCount = Math.max(entry.beneficiary.length, 1)
  if (entry.mode === '男気') return entry.paidBy === name ? entry.amount : 0
  if (entry.mode === '先輩') {
    if (entry.paidBy === name) return entry.amount / 2
    const payingTargets = beneficiaryCount - (entry.beneficiary.includes(entry.paidBy) ? 1 : 0)
    return entry.beneficiary.includes(name) && name !== entry.paidBy ? entry.amount / Math.max(payingTargets * 2, 1) : 0
  }
  return entry.beneficiary.includes(name) ? entry.amount / beneficiaryCount : 0
}

export default App
