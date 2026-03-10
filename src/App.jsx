import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ── API設定 ──
const API_URL = 'https://script.google.com/macros/s/AKfycbyzC0PGLFpLWQASgq62nv2QNLdamPOov_mceROMQqns0IwHjuD4XKXLdijdX-SYf8Yo7Q/exec'

// ── カラーテーマ ──
const C = {
  accent: '#1a7a45',
  accentLight: '#28a85e',
  accentBg: 'rgba(26,122,69,0.06)',
  accentBorder: 'rgba(26,122,69,0.15)',
  bg: '#ffffff',
  pageBg: '#f4f7f5',
  card: '#f4f7f5',
  cardBorder: '#dce6df',
  text: '#1a2b22',
  textSub: '#4a6055',
  textMuted: '#94a89c',
  red: '#d64545',
  blue: '#3b82f6',
}

// ── ユーティリティ ──

/** 日付文字列やタイムスタンプを MM/DD 形式に変換 */
const formatDate = (raw) => {
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  // フォールバック: "2024/06/15" 等のスラッシュ区切り
  const m = String(raw).match(/(\d{1,2})[\/\-](\d{1,2})$/)
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : String(raw)
}

// ── 共通コンポーネント ──

const KpiCard = ({ label, value, sub, accent }) => (
  <div style={{
    flex: 1, minWidth: 140, padding: '16px 14px', textAlign: 'center',
    background: accent ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight})` : C.card,
    border: `1px solid ${accent ? 'transparent' : C.cardBorder}`,
    borderRadius: 12,
  }}>
    <div style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,0.8)' : C.textMuted, fontWeight: 500, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: accent ? '#fff' : C.accent, letterSpacing: '-0.5px', lineHeight: 1.2 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: accent ? 'rgba(255,255,255,0.7)' : C.textMuted, marginTop: 3 }}>{sub}</div>}
  </div>
)

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10, marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 3, height: 18, background: C.accent, borderRadius: 2 }} />
    {children}
  </div>
)

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {Number(p.value).toLocaleString()}</div>
      ))}
    </div>
  )
}

const DataTable = ({ headers, rows, maxRows = 10 }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              textAlign: i === 0 || i === 1 ? 'left' : 'right',
              padding: '8px 10px', color: C.textMuted, fontWeight: 600,
              borderBottom: `2px solid ${C.cardBorder}`, whiteSpace: 'nowrap',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, maxRows).map((row, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
            {row.map((cell, j) => (
              <td key={j} style={{
                textAlign: j === 0 || j === 1 ? 'left' : 'right',
                padding: '8px 10px', color: j <= 1 ? C.text : C.textSub,
                fontWeight: j <= 1 ? 600 : 400,
                maxWidth: j === 1 ? 200 : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{typeof cell === 'number' ? cell.toLocaleString() : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: C.textMuted }}>
    <div>データを読み込み中...</div>
  </div>
)

const ErrorMsg = ({ message, onRetry }) => (
  <div style={{ textAlign: 'center', padding: 40, color: C.textSub }}>
    <div style={{ fontSize: 14, marginBottom: 12 }}>{message}</div>
    {onRetry && (
      <button onClick={onRetry} style={{
        padding: '8px 20px', border: `1px solid ${C.accent}`, borderRadius: 8,
        background: 'transparent', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>再読み込み</button>
    )}
  </div>
)


// ── アカウント概要タブ ──

const PERIOD_OPTIONS = [
  { key: 7, label: '7日' },
  { key: 14, label: '14日' },
  { key: 30, label: '30日' },
  { key: 0, label: '全期間' },
]

function AccountTab({ data }) {
  const [period, setPeriod] = useState(0)

  if (!data || data.length === 0) return <ErrorMsg message="アカウントデータがまだありません" />

  const filtered = period > 0 ? data.slice(-period) : data

  const latest = filtered[filtered.length - 1]
  const first = filtered[0]
  const startFollowers = (first['フォロワー数'] || 0) - (first['フォロワー増減'] || 0)
  const endFollowers = latest['フォロワー数'] || 0
  const netGain = endFollowers - startFollowers
  const dailyAvg = filtered.length > 0 ? (netGain / filtered.length).toFixed(1) : 0

  // フォロワー推移チャート用データ
  const followerChart = filtered.map(d => ({
    date: formatDate(d['日付']),
    followers: d['フォロワー数'],
    delta: d['フォロワー増減'],
  }))

  // 日次指標チャート
  const dailyChart = filtered.map(d => ({
    date: formatDate(d['日付']),
    views: d['閲覧数'] || 0,
    interactions: d['インタラクション数'] || 0,
  }))

  return (
    <div>
      {/* 期間セレクター */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: C.bg, padding: 3, borderRadius: 8, border: `1px solid ${C.cardBorder}`, width: 'fit-content' }}>
        {PERIOD_OPTIONS.map(o => (
          <button key={o.key} onClick={() => setPeriod(o.key)} style={{
            padding: '5px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
            background: period === o.key ? C.accent : 'transparent',
            color: period === o.key ? '#fff' : C.textMuted,
          }}>{o.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiCard label="現在のフォロワー" value={endFollowers.toLocaleString()} sub={`開始時 ${startFollowers.toLocaleString()}`} accent />
        <KpiCard label="フォロワー純増" value={`+${netGain.toLocaleString()}`} sub={`${filtered.length}日間`} />
        <KpiCard label="日平均純増" value={`${dailyAvg}人`} />
        <KpiCard label="昨日の閲覧数" value={(latest['閲覧数'] || 0).toLocaleString()} />
        <KpiCard label="昨日のインタラクション" value={(latest['インタラクション数'] || 0).toLocaleString()} />
      </div>

      <SectionTitle>フォロワー推移</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: '16px 12px 8px' }}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={followerChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false}
              domain={['dataMin - 100', 'dataMax + 100']}
              tickFormatter={v => `${(v / 1000).toFixed(1)}K`} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="followers" name="フォロワー数" stroke={C.accent} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>フォロワー増減（日次）</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: '16px 12px 8px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={followerChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="delta" name="増減" radius={[3, 3, 0, 0]}>
              {followerChart.map((d, i) => (
                <rect key={i} fill={d.delta >= 0 ? C.accentLight : C.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>閲覧数・インタラクション（日次）</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: '16px 12px 8px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="views" name="閲覧数" stroke={C.blue} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="interactions" name="インタラクション" stroke={C.accent} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* フォロワー属性（常に最新データを使用） */}
      {data[data.length - 1]['フォロワー都市TOP5'] && (
        <>
          <SectionTitle>フォロワー属性</SectionTitle>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: 16, fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
            <div><strong style={{ color: C.text }}>都市TOP5:</strong> {data[data.length - 1]['フォロワー都市TOP5']}</div>
            <div><strong style={{ color: C.text }}>国TOP5:</strong> {data[data.length - 1]['フォロワー国TOP5']}</div>
            <div><strong style={{ color: C.text }}>性別×年齢:</strong> {data[data.length - 1]['フォロワー性別年齢']}</div>
          </div>
        </>
      )}
    </div>
  )
}


// ── 通常投稿タブ ──

function FeedTab({ data }) {
  if (!data || data.length === 0) return <ErrorMsg message="通常投稿のデータがまだありません" />

  const totalReach = data.reduce((s, d) => s + (d['リーチ'] || 0), 0)
  const totalViews = data.reduce((s, d) => s + (d['閲覧数'] || 0), 0)
  const totalLikes = data.reduce((s, d) => s + (d['いいね'] || 0), 0)
  const totalSaves = data.reduce((s, d) => s + (d['保存数'] || 0), 0)
  const totalFollows = data.reduce((s, d) => s + (d['フォロー数'] || 0), 0)

  const sorted = [...data].sort((a, b) => (b['リーチ'] || 0) - (a['リーチ'] || 0))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiCard label="投稿数" value={data.length} accent />
        <KpiCard label="閲覧数合計" value={totalViews.toLocaleString()} />
        <KpiCard label="リーチ合計" value={totalReach.toLocaleString()} />
        <KpiCard label="いいね合計" value={totalLikes.toLocaleString()} />
        <KpiCard label="保存数合計" value={totalSaves.toLocaleString()} />
        <KpiCard label="フォロー獲得" value={totalFollows.toLocaleString()} />
      </div>

      <SectionTitle>投稿一覧（リーチ順）</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: 16 }}>
        <DataTable
          headers={['投稿日', '内容', 'タイプ', '閲覧数', 'リーチ', 'いいね', '保存', 'シェア', 'フォロー']}
          rows={sorted.map(d => [
            d['投稿日'], d['内容'], d['メディアタイプ'],
            d['閲覧数'] || 0, d['リーチ'] || 0, d['いいね'] || 0,
            d['保存数'] || 0, d['シェア'] || 0, d['フォロー数'] || 0,
          ])}
          maxRows={25}
        />
      </div>
    </div>
  )
}


// ── リールタブ ──

function ReelsTab({ data }) {
  if (!data || data.length === 0) return <ErrorMsg message="リールのデータがまだありません" />

  const totalViews = data.reduce((s, d) => s + (d['閲覧数'] || 0), 0)
  const totalReach = data.reduce((s, d) => s + (d['リーチ'] || 0), 0)
  const totalSaves = data.reduce((s, d) => s + (d['保存数'] || 0), 0)
  const totalShares = data.reduce((s, d) => s + (d['シェア'] || 0), 0)
  const totalInteractions = data.reduce((s, d) => s + (d['インタラクション合計'] || 0), 0)

  const avgWatchTimes = data.filter(d => d['平均視聴時間(秒)'] > 0)
  const overallAvgWatch = avgWatchTimes.length > 0
    ? (avgWatchTimes.reduce((s, d) => s + d['平均視聴時間(秒)'], 0) / avgWatchTimes.length).toFixed(1)
    : '—'

  const sorted = [...data].sort((a, b) => (b['閲覧数'] || 0) - (a['閲覧数'] || 0))

  // リーチ棒グラフ
  const chartData = sorted.slice(0, 10).map(d => ({
    name: (d['内容'] || '').substring(0, 15),
    views: d['閲覧数'] || 0,
    reach: d['リーチ'] || 0,
  }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiCard label="リール数" value={data.length} accent />
        <KpiCard label="閲覧数合計" value={totalViews.toLocaleString()} />
        <KpiCard label="リーチ合計" value={totalReach.toLocaleString()} />
        <KpiCard label="保存数合計" value={totalSaves.toLocaleString()} />
        <KpiCard label="シェア合計" value={totalShares.toLocaleString()} />
        <KpiCard label="平均視聴時間" value={`${overallAvgWatch}秒`} />
      </div>

      <SectionTitle>閲覧数・リーチ TOP10</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: '16px 12px 8px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: C.textMuted }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.textSub }} width={80} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="views" name="閲覧数" fill={C.accentLight} radius={[0, 4, 4, 0]} barSize={14} />
            <Bar dataKey="reach" name="リーチ" fill={C.blue} radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>リール一覧（閲覧数順）</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: 16 }}>
        <DataTable
          headers={['投稿日', '内容', '閲覧数', 'リーチ', 'いいね', '保存', 'シェア', '平均視聴(秒)']}
          rows={sorted.map(d => [
            d['投稿日'], d['内容'],
            d['閲覧数'] || 0, d['リーチ'] || 0, d['いいね'] || 0,
            d['保存数'] || 0, d['シェア'] || 0, d['平均視聴時間(秒)'] || 0,
          ])}
          maxRows={25}
        />
      </div>
    </div>
  )
}


// ── ストーリーズタブ ──

function StoriesTab({ data }) {
  if (!data || data.length === 0) return <ErrorMsg message="ストーリーズのデータがまだありません（24時間以内に公開されたものが対象）" />

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiCard label="ストーリー数" value={data.length} accent />
        <KpiCard label="閲覧数合計" value={data.reduce((s, d) => s + (d['閲覧数'] || 0), 0).toLocaleString()} />
        <KpiCard label="リーチ合計" value={data.reduce((s, d) => s + (d['リーチ'] || 0), 0).toLocaleString()} />
      </div>

      <SectionTitle>ストーリーズ一覧</SectionTitle>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: 16 }}>
        <DataTable
          headers={['投稿日', '内容', '閲覧数', 'リーチ', 'シェア', 'フォロー', 'ナビゲーション']}
          rows={data.map(d => [
            d['投稿日'], d['内容'],
            d['閲覧数'] || 0, d['リーチ'] || 0, d['シェア'] || 0,
            d['フォロー数'] || 0, d['ナビゲーション'] || 0,
          ])}
        />
      </div>
    </div>
  )
}


// ── メインApp ──

export default function App() {
  const [tab, setTab] = useState('account')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const types = ['account', 'feed', 'reels', 'stories']
      const results = {}
      for (const type of types) {
        const res = await fetch(`${API_URL}?type=${type}`)
        const json = await res.json()
        results[type] = json.data || []
      }
      setData(results)
      setLastUpdated(new Date())
    } catch (e) {
      setError(`データの取得に失敗しました: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const tabs = [
    { key: 'account', label: 'アカウント概要', icon: '📊' },
    { key: 'feed', label: '通常投稿', icon: '🏔' },
    { key: 'reels', label: 'リール', icon: '🎬' },
    { key: 'stories', label: 'ストーリーズ', icon: '📱' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* ヘッダー */}
      <header style={{ padding: '24px 0 16px', borderBottom: `3px solid ${C.accent}`, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: C.accentLight, letterSpacing: 2, fontWeight: 600, marginBottom: 2 }}>
              ASOSTAGRAM INSIGHTS DASHBOARD
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
              asostagram インサイトダッシュボード
            </h1>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: C.textMuted }}>
            {lastUpdated && <div>最終取得: {lastUpdated.toLocaleString('ja-JP')}</div>}
            <button onClick={fetchData} style={{
              marginTop: 4, padding: '4px 12px', border: `1px solid ${C.cardBorder}`,
              borderRadius: 6, background: C.bg, fontSize: 11, cursor: 'pointer', color: C.textSub,
            }}>↻ 更新</button>
          </div>
        </div>
      </header>

      {/* タブ */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.bg, padding: 4, borderRadius: 10, border: `1px solid ${C.cardBorder}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px 16px', border: 'none', borderRadius: 7, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
            background: tab === t.key ? C.accent : 'transparent',
            color: tab === t.key ? '#fff' : C.textMuted,
          }}>
            {t.icon} {t.label}
            {data[t.key] && <span style={{
              marginLeft: 6, fontSize: 10, opacity: 0.8,
              background: tab === t.key ? 'rgba(255,255,255,0.2)' : C.accentBg,
              padding: '1px 6px', borderRadius: 10,
              color: tab === t.key ? '#fff' : C.accent,
            }}>{data[t.key].length}</span>}
          </button>
        ))}
      </nav>

      {/* コンテンツ */}
      {loading ? <Loading /> : error ? <ErrorMsg message={error} onRetry={fetchData} /> : (
        <>
          {tab === 'account' && <AccountTab data={data.account} />}
          {tab === 'feed' && <FeedTab data={data.feed} />}
          {tab === 'reels' && <ReelsTab data={data.reels} />}
          {tab === 'stories' && <StoriesTab data={data.stories} />}
        </>
      )}

      {/* フッター */}
      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${C.cardBorder}`, fontSize: 10, color: C.textMuted, textAlign: 'center' }}>
        asostagram（@asostagram）インサイトダッシュボード ｜ データはInstagram Graph API経由で自動取得
      </footer>
    </div>
  )
}
