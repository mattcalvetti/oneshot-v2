import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const fmt = (n) => '$' + Math.round(n).toLocaleString();
const pct = (n) => n.toFixed(1) + '%';

const defaultForm = {
  name: '', age: '', income: '', frequency: 'annual', currency: 'AUD',
  cash: '', cashFloor: '', creditBalance: '', creditTarget: '',
  etfs: '', crypto: '', super: '', property: '', other_assets: '',
  rent: '', utilities: '', groceries: '', dining: '', transport: '', health: '', subscriptions: '', personal: '', savings_invest: '',
  hasEquity: false, equityValue: '', vestingMonths: '48', vestedMonths: '', companyVal: '',
  nextPayday: '', payFrequency: 'fortnightly', expenseFrequency: 'monthly'
};

const tooltips = {
  cashFloor: 'The minimum cash you keep as a buffer. Usually 2-3 months of expenses. Money only moves to investments when you\'re above this.',
  creditTarget: 'Your target credit card balance by end of pay cycle. Usually ≤1 cycle of spending.',
  creditBalance: 'What you currently owe on your credit card.',
};

export default function App() {
  const [view, setView] = useState('landing');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [showTip, setShowTip] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('wealth-data');
    if (saved) {
      const p = JSON.parse(saved);
      setForm({ ...defaultForm, ...p.form });
      setAnalysis(p.analysis || null);
      if (p.form?.name) setView('dashboard');
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized || view !== 'dashboard') return;
    localStorage.setItem('wealth-data', JSON.stringify({ form, analysis }));
  }, [form, analysis, view, initialized]);

  const reset = () => { localStorage.removeItem('wealth-data'); setForm(defaultForm); setAnalysis(null); setView('landing'); };

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const num = (v) => parseFloat(v) || 0;
  const monthlyIncome = form.frequency === 'annual' ? num(form.income) / 12 : form.frequency === 'fortnightly' ? num(form.income) * 26 / 12 : num(form.income);
  const expenseMultiplier = form.expenseFrequency === 'weekly' ? 4.33 : form.expenseFrequency === 'fortnightly' ? 2.17 : 1;
  const expenses = ['rent','utilities','groceries','dining','transport','health','subscriptions','personal','savings_invest'].reduce((a, k) => a + num(form[k]), 0) * expenseMultiplier;
  const surplus = monthlyIncome - expenses;
  const rate = monthlyIncome > 0 ? (surplus / monthlyIncome) * 100 : 0;
  const liquid = num(form.cash) + num(form.etfs) + num(form.crypto);
  const illiquid = num(form.super) + num(form.property) + num(form.other_assets);
  const netWorth = liquid + illiquid - num(form.creditBalance);
  const equityValue = num(form.equityValue);
  const vestedValue = equityValue * (num(form.vestedMonths) / num(form.vestingMonths));
  
  const cashOk = num(form.cash) >= num(form.cashFloor) || !form.cashFloor;
  const creditOk = num(form.creditBalance) <= num(form.creditTarget) || !form.creditTarget;
  const rateOk = rate >= 20;

  const projectionData = [0,1,2,3,4,5].map(y => {
    const r = 0.07/12, m = y*12, contrib = Math.max(0, surplus) * 0.8, start = num(form.etfs) + num(form.crypto);
    return { year: y, value: Math.round(start * Math.pow(1+r, m) + contrib * ((Math.pow(1+r, m) - 1) / r)) };
  });

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `You're a thoughtful, direct financial advisor. Analyze this wealth system. Be genuinely helpful. No fluff.

${form.name}, ${form.age}
Income: ${fmt(monthlyIncome)}/month
Expenses: ${fmt(expenses)}/month  
Surplus: ${fmt(surplus)}/month
Savings Rate: ${pct(rate)}
Cash: ${fmt(num(form.cash))} (floor: ${fmt(num(form.cashFloor))})
Credit: ${fmt(num(form.creditBalance))} (target: ≤${fmt(num(form.creditTarget))})
Assets: ETFs ${fmt(num(form.etfs))}, Crypto ${fmt(num(form.crypto))}, Super ${fmt(num(form.super))}
${form.hasEquity ? `Equity: ${fmt(equityValue)} (${form.vestedMonths}/${form.vestingMonths} months vested)` : ''}
Net Worth: ${fmt(netWorth)}

Give 3 insights as JSON. Each has "title" (3-5 words), "body" (2 sentences max), "type" (celebrate/warning/opportunity). Add "oneMove": single most important action. Add "headline": poetic 4-6 word summary.

ONLY valid JSON: {"headline":"...","insights":[...],"oneMove":"..."}` }]
        })
      });
      const d = await res.json();
      setAnalysis(JSON.parse((d.content?.map(i => i.text).join('') || '').replace(/```json|```/g, '').trim()));
    } catch { setAnalysis({ headline: 'Analysis unavailable', insights: [{ title: 'Connection lost', body: 'Could not reach Claude.', type: 'warning' }], oneMove: 'Try again.' }); }
    setLoading(false);
  };

  const Tip = ({ id, text }) => (
    <span style={{ position: 'relative', marginLeft: 6 }}>
      <span 
        onClick={() => setShowTip(showTip === id ? null : id)}
        style={{ fontSize: 10, color: '#aaa', border: '1px solid #ddd', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >?</span>
      {showTip === id && <span style={{ position: 'absolute', bottom: 24, left: -100, width: 240, background: '#1a1a1a', color: '#fff', padding: 12, fontSize: 13, lineHeight: 1.5, borderRadius: 8, zIndex: 10 }}>{text}</span>}
    </span>
  );

  const s = {
    page: { minHeight: '100vh', background: '#fff', fontFamily: 'Georgia, serif', color: '#1a1a1a' },
    wrap: { maxWidth: 620, margin: '0 auto', padding: '60px 24px' },
    h1: { fontSize: 42, fontWeight: 400, lineHeight: 1.2, margin: 0 },
    h2: { fontSize: 24, fontWeight: 400, margin: '0 0 24px 0' },
    p: { fontSize: 17, lineHeight: 1.7, color: '#333', margin: '14px 0' },
    label: { fontSize: 11, letterSpacing: 0.5, color: '#999', display: 'flex', alignItems: 'center', marginBottom: 6 },
    input: { width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #e5e5e5', fontSize: 17, fontFamily: 'Georgia, serif', outline: 'none', background: 'transparent' },
    btn: { background: '#1a1a1a', color: '#fff', border: 'none', padding: '12px 24px', fontSize: 15, cursor: 'pointer', fontFamily: 'Georgia, serif', borderRadius: 999 },
    link: { fontSize: 13, cursor: 'pointer', color: '#999' },
    card: { background: '#fafafa', borderRadius: 8, padding: 20, marginBottom: 12 },
    metric: { fontSize: 28, fontWeight: 400, margin: '4px 0' },
    small: { fontSize: 12, color: '#999' },
    dot: (ok) => ({ width: 6, height: 6, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', display: 'inline-block', marginRight: 8 }),
  };

  // Landing
  if (view === 'landing') return (
    <div style={s.page}>
      <div style={{ ...s.wrap, paddingTop: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 40, letterSpacing: 0.5 }}>A CRITICAL ANALYSIS OF PERSONAL WEALTH</p>
        
        <h1 style={{ ...s.h1, fontSize: 38, fontStyle: 'italic' }}>
          It can calculate like a spreadsheet,<br/>
          think like an advisor,<br/>
          and teach you what both can't.
        </h1>
        
        <p style={{ ...s.p, marginTop: 40, marginBottom: 40 }}>
          Most tools show where your money went.<br/>
          This one shows where it's going.
        </p>
        
        <button style={{ ...s.btn, width: 'auto' }} onClick={() => setView('philosophy')}>Begin</button>
      </div>
    </div>
  );

  // Philosophy
  if (view === 'philosophy') return (
    <div style={{ ...s.page, position: 'relative', minHeight: '100vh' }}>
      <div style={{ ...s.wrap, paddingTop: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
        <p style={s.link} onClick={() => setView('landing')}>← back</p>
        
        <div style={{ marginTop: 64 }}>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 24, letterSpacing: 0.5 }}>THE SYSTEM</p>
          
          <p style={s.p}>
            Every pay cycle, money moves. Cash stays above your floor. Credit stays below your ceiling. The rest goes to work.
          </p>
          
          <p style={s.p}>
            That's it. No timing the market. No complexity theater.
          </p>
          
          <p style={s.p}>
            The people who build wealth aren't smarter. They just show up.<br/>Again and again. The system makes showing up automatic.
          </p>
          
          <p style={s.p}>
            Claude reads your numbers and tells you what to do next.<br/>It's pretty fucking smart.
          </p>
        </div>
        
        <p style={{ ...s.small, marginTop: 32, marginBottom: 16 }}>
          Spotify's about to open. Come back when you've got something playing.

        </p>

        <button
          style={{ ...s.btn, marginTop: 0 }}
          onClick={() => {
            window.open('https://open.spotify.com', '_blank');
            setView('setup');
          }}
        >
          Build my system
        </button>
        
        <p style={{ ...s.small, marginTop: 40, textAlign: 'center', width: '100%' }}>
        Your data stays on your device.
        </p>
      </div>
    </div>
  );

  // Setup
  if (view === 'setup') {
    return (
      <div style={s.page}>
        <div style={{ ...s.wrap, maxWidth: 520 }}>
          <p style={s.link} onClick={() => setView('philosophy')}>← back</p>
          
          <p style={{ fontSize: 13, color: '#999', marginTop: 40, marginBottom: 24, letterSpacing: 0.5 }}>THE BASICS</p>
          
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Name</label>
            <input 
              style={s.input} 
              type="text" 
              value={form.name} 
              onChange={(e) => updateField('name', e.target.value)} 
              placeholder="First name" 
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={s.label}>Age</label>
              <input style={s.input} type="text" inputMode="numeric" value={form.age} onChange={(e) => updateField('age', e.target.value)} placeholder="28" />
            </div>
            <div>
              <label style={s.label}>Income</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select style={{ ...s.input, width: 60, padding: '10px 0' }} value={form.currency} onChange={(e) => updateField('currency', e.target.value)}>
                  <option>AUD</option><option>USD</option><option>GBP</option><option>EUR</option>
                </select>
                <input style={s.input} type="text" inputMode="numeric" value={form.income} onChange={(e) => updateField('income', e.target.value)} placeholder="140000" />
              </div>
            </div>
            <div>
              <label style={s.label}>Frequency</label>
              <select style={{ ...s.input, background: 'transparent' }} value={form.frequency} onChange={(e) => updateField('frequency', e.target.value)}>
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="fortnightly">Fortnightly</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <div>
              <label style={s.label}>Next payday</label>
              <input style={s.input} type="date" value={form.nextPayday} onChange={(e) => updateField('nextPayday', e.target.value)} />
            </div>
            <div>
              <label style={s.label}>Pay frequency</label>
              <select style={{ ...s.input, background: 'transparent' }} value={form.payFrequency} onChange={(e) => updateField('payFrequency', e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          
          <p style={{ fontSize: 13, color: '#999', marginTop: 40, marginBottom: 16, letterSpacing: 0.5 }}>CASH & CREDIT</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <div>
              <label style={s.label}>Cash balance</label>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form.cash} onChange={(e) => updateField('cash', e.target.value)} placeholder="15000" /></div>
            </div>
            <div>
              <label style={s.label}>Cash floor <Tip id="floor" text={tooltips.cashFloor} /></label>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form.cashFloor} onChange={(e) => updateField('cashFloor', e.target.value)} placeholder="7000" /></div>
            </div>
            <div>
              <label style={s.label}>Credit balance <Tip id="credit" text={tooltips.creditBalance} /></label>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form.creditBalance} onChange={(e) => updateField('creditBalance', e.target.value)} placeholder="2500" /></div>
            </div>
            <div>
              <label style={s.label}>Credit target <Tip id="target" text={tooltips.creditTarget} /></label>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form.creditTarget} onChange={(e) => updateField('creditTarget', e.target.value)} placeholder="2200" /></div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 16 }}>
  <p style={{ fontSize: 13, color: '#999', letterSpacing: 0.5, margin: 0 }}>EXPENSES</p>
  <select 
    style={{ ...s.input, width: 'auto', padding: '4px 8px', fontSize: 12, borderBottom: 'none', color: '#999' }} 
    value={form.expenseFrequency} 
    onChange={(e) => updateField('expenseFrequency', e.target.value)}
  >
    <option value="weekly">Weekly</option>
    <option value="fortnightly">Fortnightly</option>
    <option value="monthly">Monthly</option>
  </select>
</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
            {[['rent','Rent/mortgage'],['utilities','Utilities'],['groceries','Groceries'],['dining','Dining/social'],['transport','Transport'],['health','Health/fitness'],['subscriptions','Subscriptions'],['personal','Personal'],['savings_invest','Savings/invest']].map(([k,l]) => (
              <div key={k}>
                <label style={s.label}>{l}</label>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form[k]} onChange={(e) => updateField(k, e.target.value)} placeholder="0" /></div>
              </div>
            ))}
          </div>
          
          <p style={{ fontSize: 13, color: '#999', marginTop: 40, marginBottom: 16, letterSpacing: 0.5 }}>ASSETS</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
            {[['etfs','ETFs/stocks'],['crypto','Crypto'],['super','Super/401k'],['property','Property equity'],['other_assets','Other']].map(([k,l]) => (
              <div key={k}>
                <label style={s.label}>{l}</label>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form[k]} onChange={(e) => updateField(k, e.target.value)} placeholder="0" /></div>
              </div>
            ))}
          </div>
          
          <div style={{ borderTop: '1px solid #eee', paddingTop: 24, marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 15 }}>
              <input type="checkbox" checked={form.hasEquity} onChange={(e) => updateField('hasEquity', e.target.checked)} />
              I have startup equity
            </label>
            {form.hasEquity && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
                <div>
                  <label style={s.label}>Total equity value</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form.equityValue} onChange={(e) => updateField('equityValue', e.target.value)} placeholder="190000" /></div>
                </div>
                <div>
                  <label style={s.label}>Company valuation</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ color: '#999', marginRight: 4 }}>$</span><input style={s.input} type="text" inputMode="numeric" value={form.companyVal} onChange={(e) => updateField('companyVal', e.target.value)} placeholder="6700000" /></div>
                </div>
                <div>
                  <label style={s.label}>Vesting period (months)</label>
                  <input style={s.input} type="text" inputMode="numeric" value={form.vestingMonths} onChange={(e) => updateField('vestingMonths', e.target.value)} placeholder="48" />
                </div>
                <div>
                  <label style={s.label}>Months vested</label>
                  <input style={s.input} type="text" inputMode="numeric" value={form.vestedMonths} onChange={(e) => updateField('vestedMonths', e.target.value)} placeholder="12" />
                </div>
              </div>
            )}
          </div>
          
          <button style={{ ...s.btn, width: '100%' }} onClick={() => setView('dashboard')}>Show me everything</button>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div style={s.page}>
      <div style={{ ...s.wrap, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
          <div />
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={s.link} onClick={() => setView('setup')}>edit</span>
            <span style={{ ...s.link, color: '#ccc' }} onClick={reset}>reset</span>
          </div>
        </div>
        
        <h1 style={{ ...s.h1, fontSize: 32 }}>{form.name ? `${form.name}'s` : 'Your'} system.</h1>
        <p style={{ ...s.small, marginBottom: 40 }}>Net worth {fmt(netWorth)} · Savings rate {pct(rate)}</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={s.card}>
            <p style={s.label}><span style={s.dot(cashOk)} />Cash</p>
            <p style={s.metric}>{fmt(num(form.cash))}</p>
            <p style={s.small}>floor {fmt(num(form.cashFloor))}</p>
          </div>
          <div style={s.card}>
            <p style={s.label}><span style={s.dot(creditOk)} />Credit</p>
            <p style={s.metric}>{fmt(num(form.creditBalance))}</p>
            <p style={s.small}>target ≤{fmt(num(form.creditTarget))}</p>
          </div>
          <div style={s.card}>
            <p style={s.label}><span style={s.dot(rateOk)} />Rate</p>
            <p style={s.metric}>{pct(rate)}</p>
            <p style={s.small}>{fmt(surplus)}/mo</p>
          </div>
        </div>
        
        <div style={{ ...s.card, marginTop: 12 }}>
          <p style={{ ...s.label, marginBottom: 16 }}>Projection</p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}K`} width={50} />
                <Tooltip formatter={v => fmt(v)} labelFormatter={v => `Year ${v}`} />
                <Line type="monotone" dataKey="value" stroke="#1a1a1a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
            {[1,2,3,5].map(y => <div key={y} style={{ textAlign: 'center' }}><p style={s.small}>{y}yr</p><p style={{ fontSize: 15, margin: '4px 0' }}>{fmt(projectionData.find(d => d.year === y)?.value || 0)}</p></div>)}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: form.hasEquity ? '1fr 1fr' : '1fr', gap: 12, marginTop: 12 }}>
          <div style={s.card}>
            <p style={{ ...s.label, marginBottom: 12 }}>Assets</p>
            {[['ETFs', form.etfs],['Crypto', form.crypto],['Super', form.super],['Property', form.property],['Other', form.other_assets]].filter(([,v]) => num(v) > 0).map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 15 }}><span style={{ color: '#666' }}>{l}</span><span>{fmt(num(v))}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTop: '1px solid #eee', fontWeight: 500, fontSize: 15 }}><span>Total</span><span>{fmt(liquid + illiquid)}</span></div>
          </div>
          {form.hasEquity && (
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom: 12 }}>Equity</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 15 }}><span style={{ color: '#666' }}>Total value</span><span>{fmt(equityValue)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 15 }}><span style={{ color: '#666' }}>Vested ({form.vestedMonths || 0}/{form.vestingMonths})</span><span>{fmt(vestedValue)}</span></div>
              <div style={{ background: '#e5e5e5', height: 4, borderRadius: 2 }}>
                <div style={{ background: '#1a1a1a', height: '100%', width: `${(num(form.vestedMonths) / num(form.vestingMonths)) * 100}%`, borderRadius: 2 }} />
              </div>
              {num(form.companyVal) > 0 && <p style={{ ...s.small, marginTop: 12 }}>Valuation: {fmt(num(form.companyVal))}</p>}
            </div>
          )}
        </div>
        
        <div style={{ ...s.card, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={s.label}>Claude's take</p>
            <button onClick={runAnalysis} disabled={loading} style={{ background: '#fff', border: '1px solid #ddd', padding: '8px 16px', fontSize: 13, borderRadius: 999, cursor: loading ? 'wait' : 'pointer', fontFamily: 'Georgia, serif' }}>
              {loading ? 'Thinking...' : 'Analyze'}
            </button>
          </div>
          {analysis ? (
            <>
              {analysis.headline && <p style={{ fontSize: 18, fontStyle: 'italic', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #eee' }}>{analysis.headline}</p>}
              {analysis.insights?.map((ins, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ins.type === 'celebrate' ? '#22c55e' : ins.type === 'warning' ? '#ef4444' : '#3b82f6' }} />
                    {ins.title}
                  </p>
                  <p style={{ margin: '4px 0 0 14px', color: '#666', fontSize: 14, lineHeight: 1.5 }}>{ins.body}</p>
                </div>
              ))}
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginTop: 16 }}>
                <p style={{ ...s.small, marginBottom: 4 }}>Your one move</p>
                <p style={{ margin: 0, fontSize: 15 }}>{analysis.oneMove}</p>
              </div>
            </>
          ) : (
            <p style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>Hit analyze for Claude's interpretation.</p>
          )}
        </div>
        
        <p style={{ ...s.small, marginTop: 40, position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center' }}>
          Your data stays on your device.
        </p>
      </div>
    </div>
  );
}