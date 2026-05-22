
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { formatIndian, getCurrentFinancialYear } from "@/lib/format";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { UserRole } from "@/types/database";

type DrillLevel = "summary" | "department" | "lineitem";
interface KPI { id:string; label:string; value:number; prev:number; unit:"crore"|"pct"|"months"; goodWhenUp:boolean; }
interface SummaryRow { id:string; category:string; budget:number; actual:number; variance:number; variancePct:number; }
interface DeptRow { id:string; department:string; budget:number; actual:number; variance:number; }
interface LineItemRow { id:string; lineItem:string; budget:number; actual:number; variance:number; notes:string; }

function fyMonths(y:number):string[]{
  return ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"]
    .map((m,i)=>m+" "+String(i<=8?y:y+1).slice(2));
}
const MONTHS=fyMonths(2025);
const C={red:"#E52D31",yellow:"#F7DA11",dark:"#852321",muted:"rgba(255,255,255,0.2)"};

// ─── Robotek India — FY 2025-26 actuals (₹ values in rupees) ──────────────────
// Scale: ₹18–20 Cr annual revenue, mobile accessories manufacturing
const kpis:KPI[]=[
  {id:"revenue",  label:"Revenue (YTD)",     value:184000000,  prev:165000000,  unit:"crore", goodWhenUp:true },
  {id:"gross_m",  label:"Gross Margin",      value:39.1,       prev:37.0,       unit:"pct",   goodWhenUp:true },
  {id:"cash",     label:"Cash Balance",      value:5579000,    prev:5780000,    unit:"crore", goodWhenUp:true },
  {id:"ar_days",  label:"AR Days (DSO)",     value:47,         prev:52,         unit:"months",goodWhenUp:false},
  {id:"ap",       label:"AP Outstanding",    value:4650000,    prev:4380000,    unit:"crore", goodWhenUp:false},
  {id:"ar",       label:"AR Outstanding",    value:6835000,    prev:6580000,    unit:"crore", goodWhenUp:false},
  {id:"opex_m",   label:"OpEx MTD",          value:3420000,    prev:3350000,    unit:"crore", goodWhenUp:false},
  {id:"tax",      label:"Tax Liability",     value:696000,     prev:710000,     unit:"crore", goodWhenUp:false},
];

// Revenue base: ₹142L–184L per month over FY 2025-26
const revenueBase=[148,153,168,155,160,176,142,155,172,161,172,184].map(v=>v*100000);
const plTrend=MONTHS.map((m,i)=>({
  month:m,
  revenue:revenueBase[i],
  expenses:Math.round(revenueBase[i]*0.795),
  ebitda:Math.round(revenueBase[i]*0.205),
}));
const cashFlowData=MONTHS.map((m,i)=>({month:m,operating:Math.round((revenueBase[i]*0.12)),investing:Math.round((-revenueBase[i]*0.03)),financing:Math.round((revenueBase[i]*0.01))}));
// Revenue by channel — Robotek actual segments
const segmentData=[
  {name:"Domestic Retail",  revenue:Math.round(184000000*0.52)},
  {name:"E-Commerce",       revenue:Math.round(184000000*0.28)},
  {name:"Export / B2B",     revenue:Math.round(184000000*0.12)},
  {name:"Govt / Tender",    revenue:Math.round(184000000*0.08)},
];

// P&L summary — Robotek India FY 2025-26 (Mar 2026 MTD, ₹)
const summaryRows:SummaryRow[]=[
  {id:"rev",  category:"Revenue",           budget: 19000000,actual:18400000,variance: -600000,variancePct:-3.2 },
  {id:"cogs", category:"Cost of Goods Sold",budget: 11600000,actual:11200000,variance:  400000,variancePct: 3.4 },
  {id:"gross",category:"Gross Profit",      budget:  7400000,actual: 7200000,variance: -200000,variancePct:-2.7 },
  {id:"opex", category:"Operating Expenses",budget:  3400000,actual: 3420000,variance:  -20000,variancePct:-0.6 },
  {id:"ebit", category:"EBIT",              budget:  4000000,actual: 3780000,variance: -220000,variancePct:-5.5 },
  {id:"tax",  category:"Tax",               budget:   700000,actual:  696000,variance:   4000,variancePct:  0.6 },
  {id:"pat",  category:"Profit After Tax",  budget:  3300000,actual: 3084000,variance: -216000,variancePct:-6.5 },
];

// Dept & line-item rows — Robotek India scale (OpEx total ₹34.2L, COGS total ₹112L)
const deptRows:Record<string,DeptRow[]>={
  opex:[
    {id:"eng",  department:"Product Engineering",budget:1400000,actual:1600000,variance:-200000},
    {id:"sales",department:"Sales & Marketing",  budget:1000000,actual:1050000,variance: -50000},
    {id:"gna",  department:"G&A",                budget: 600000,actual: 520000,variance:  80000},
    {id:"tech", department:"Tech / IT",           budget: 400000,actual: 250000,variance: 150000},
  ],
  cogs:[
    {id:"mfg",department:"Assembly & Mfg", budget:7400000,actual:7000000,variance: 400000},
    {id:"log",department:"Logistics",      budget:2600000,actual:2800000,variance:-200000},
    {id:"qc", department:"Quality Control",budget:1600000,actual:1400000,variance: 200000},
  ],
};

const lineItemRows:Record<string,LineItemRow[]>={
  eng:[
    {id:"sal", lineItem:"Salaries",       budget:1000000,actual:1200000,variance:-200000,notes:"Two senior hires above band"},
    {id:"soft",lineItem:"Software/Tools", budget: 250000,actual: 280000,variance: -30000,notes:"Figma + Jira licences up"},
    {id:"cont",lineItem:"Contract Labour",budget: 150000,actual: 120000,variance:  30000,notes:"On track"},
  ],
  sales:[
    {id:"adv",lineItem:"Advertising",   budget:400000,actual:420000,variance:-20000,notes:"Digital ads extended"},
    {id:"evt",lineItem:"Trade Events",  budget:300000,actual:350000,variance:-50000,notes:"Expo stall cost overrun"},
    {id:"com",lineItem:"Commissions",   budget:300000,actual:280000,variance: 20000,notes:"Deal slippage Mar"},
  ],
  mfg:[
    {id:"rm", lineItem:"Raw Materials",   budget:5200000,actual:4800000,variance: 400000,notes:"Supplier volume discount"},
    {id:"lab",lineItem:"Factory Labour",  budget:1400000,actual:1450000,variance: -50000,notes:"Overtime in peak week"},
    {id:"ovh",lineItem:"Factory Overhead",budget: 800000,actual: 750000,variance:  50000,notes:"Efficiency improvement"},
  ],
};

function KPICard({kpi}:{kpi:KPI}){
  const delta=kpi.value-kpi.prev;
  const pct=((delta/Math.abs(kpi.prev))*100).toFixed(1);
  const isGood=kpi.goodWhenUp?delta>=0:delta<0;
  const Icon=delta>0?TrendingUp:delta<0?TrendingDown:Minus;
  const tc=isGood?"text-emerald-400":"text-red-400";
  const dv=kpi.unit==="pct"?kpi.value.toFixed(1)+"%":kpi.unit==="months"?kpi.value+" mo":formatIndian(kpi.value);
  return(
    <Card className="bg-[#1F1B20] border-white/10 hover:border-[#E52D31]/40 transition-colors">
      <CardContent className="pt-5 pb-4 px-5">
        <p className="text-xs text-white/50 uppercase tracking-widest mb-1">{kpi.label}</p>
        <p className="text-2xl font-bold text-white">{dv}</p>
        <div className={`flex items-center gap-1 mt-2 text-xs ${tc}`}>
          <Icon className="w-3 h-3"/>
          <span>{delta>=0?"+":""}{pct}% vs prev</span>
        </div>
      </CardContent>
    </Card>
  );
}

function VBadge({pct}:{pct:number}){
  const cls=pct>=0?"bg-emerald-500/20 text-emerald-400 border-emerald-500/30":"bg-red-500/20 text-red-400 border-red-500/30";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${cls}`}>{pct>=0?"+":""}{pct.toFixed(1)}%</span>;
}

function CT({active,payload,label}:{active?:boolean;payload?:Array<{color:string;name:string;value:number}>;label?:string}){
  if(!active||!payload?.length)return null;
  return(
    <div className="bg-[#1F1B20] border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-white/60 mb-2">{label}</p>
      {payload.map(p=><p key={p.name} style={{color:p.color}} className="mb-0.5">{p.name}: {formatIndian(p.value)}</p>)}
    </div>
  );
}

interface Props{userRole:UserRole;userName:string;}

export function CFODashboardClient({userName}:Props){
  const [drillLevel,setDrillLevel]=useState<DrillLevel>("summary");
  const [activeSummary,setActiveSummary]=useState<SummaryRow|null>(null);
  const [activeDept,setActiveDept]=useState<DeptRow|null>(null);
  const [dialogOpen,setDialogOpen]=useState(false);

  function openDept(row:SummaryRow){
    if(!deptRows[row.id])return;
    setActiveSummary(row);setActiveDept(null);setDrillLevel("department");setDialogOpen(true);
  }
  function openLineItem(dept:DeptRow){
    if(!lineItemRows[dept.id])return;
    setActiveDept(dept);setDrillLevel("lineitem");
  }
  function closeDrill(){setDrillLevel("summary");setActiveSummary(null);setActiveDept(null);setDialogOpen(false);}

  const depts=activeSummary?(deptRows[activeSummary.id]??[]):[];
  const lineItems=activeDept?(lineItemRows[activeDept.id]??[]):[];
  const fy=getCurrentFinancialYear();

  return(
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Welcome back, {userName}</h2>
        <p className="text-sm text-white/40 mt-0.5">FY {fy} · Consolidated · All figures in INR</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k=><KPICard key={k.id} kpi={k}/>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#1F1B20] border-white/10 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/60 uppercase tracking-widest">P&L Trend — FY {fy}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={plTrend} margin={{top:5,right:10,left:10,bottom:0}}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.red}    stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.red}    stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.yellow} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={C.yellow} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                <XAxis dataKey="month" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}}/>
                <YAxis tickFormatter={(v:number)=>formatIndian(v)} tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} width={85}/>
                <Tooltip content={<CT/>}/>
                <Legend wrapperStyle={{fontSize:11,color:"rgba(255,255,255,0.5)"}}/>
                <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke={C.red}    fill="url(#gR)" strokeWidth={2}/>
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={C.muted}  fill={C.muted}  strokeWidth={1.5}/>
                <Area type="monotone" dataKey="ebitda"   name="EBITDA"   stroke={C.yellow} fill="url(#gE)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#1F1B20] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/60 uppercase tracking-widest">Revenue by Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={segmentData} margin={{top:5,right:5,left:5,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                <XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}}/>
                <YAxis tickFormatter={(v:number)=>formatIndian(v)} tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} width={80}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                  {segmentData.map((_,i)=><Cell key={i} fill={[C.red,C.yellow,C.dark,C.muted][i%4]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1F1B20] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white/60 uppercase tracking-widest">Cash Flow Statement — FY {fy}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashFlowData} margin={{top:5,right:10,left:10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}}/>
              <YAxis tickFormatter={(v:number)=>formatIndian(v)} tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} width={85}/>
              <Tooltip content={<CT/>}/>
              <Legend wrapperStyle={{fontSize:11,color:"rgba(255,255,255,0.5)"}}/>
              <Bar dataKey="operating"  name="Operating"  fill={C.red}    radius={[3,3,0,0]}/>
              <Bar dataKey="investing"  name="Investing"  fill={C.dark}   radius={[3,3,0,0]}/>
              <Bar dataKey="financing"  name="Financing"  fill={C.yellow} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-[#1F1B20] border-white/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold text-white/60 uppercase tracking-widest">P&L Summary — click a row to drill down</CardTitle>
          <Badge variant="outline" className="text-white/40 border-white/20 text-xs">Layer 1 of 3</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50 pl-5">Category</TableHead>
                <TableHead className="text-white/50 text-right">Budget</TableHead>
                <TableHead className="text-white/50 text-right">Actual</TableHead>
                <TableHead className="text-white/50 text-right">Variance</TableHead>
                <TableHead className="text-white/50 text-right pr-5">Var %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.map(row=>{
                const hd=!!deptRows[row.id];
                return(
                  <TableRow key={row.id} className={`border-white/5 ${hd?"cursor-pointer hover:bg-white/5":""}`} onClick={()=>hd&&openDept(row)}>
                    <TableCell className="pl-5 font-medium text-white/80">
                      <span className="flex items-center gap-2">
                        {row.category}
                        {hd&&<span className="text-[10px] text-[#E52D31] border border-[#E52D31]/40 rounded px-1 py-0.5">drill →</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-white/50 font-mono text-sm">{formatIndian(row.budget)}</TableCell>
                    <TableCell className="text-right text-white font-mono text-sm">{formatIndian(row.actual)}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${row.variance>=0?"text-emerald-400":"text-red-400"}`}>{row.variance>=0?"+":""}{formatIndian(row.variance)}</TableCell>
                    <TableCell className="text-right pr-5"><VBadge pct={row.variancePct}/></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={o=>{if(!o)closeDrill();}}>
        <DialogContent className="max-w-3xl bg-[#1F1B20] border-white/10 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-white">
                {drillLevel==="department"?`${activeSummary?.category} — By Department`:`${activeDept?.department} — Line Items`}
              </DialogTitle>
              <Badge variant="outline" className="text-white/40 border-white/20 text-xs">Layer {drillLevel==="department"?"2":"3"} of 3</Badge>
            </div>
            {drillLevel==="lineitem"&&(
              <Button variant="ghost" size="sm" className="text-[#E52D31] hover:text-[#E52D31] p-0 h-auto text-xs" onClick={()=>{setDrillLevel("department");setActiveDept(null);}}>
                ← Back to departments
              </Button>
            )}
          </DialogHeader>

          {drillLevel==="department"&&depts.length>0&&(
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={depts} margin={{top:5,right:5,left:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="department" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}}/>
                  <YAxis tickFormatter={(v:number)=>formatIndian(v)} tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} width={80}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="budget" name="Budget" fill={C.muted} radius={[3,3,0,0]}/>
                  <Bar dataKey="actual" name="Actual" fill={C.red}   radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/50">Department</TableHead>
                    <TableHead className="text-white/50 text-right">Budget</TableHead>
                    <TableHead className="text-white/50 text-right">Actual</TableHead>
                    <TableHead className="text-white/50 text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depts.map(dept=>{
                    const hl=!!lineItemRows[dept.id];
                    return(
                      <TableRow key={dept.id} className={`border-white/5 ${hl?"cursor-pointer hover:bg-white/5":""}`} onClick={()=>hl&&openLineItem(dept)}>
                        <TableCell className="font-medium text-white/80">
                          <span className="flex items-center gap-2">
                            {dept.department}
                            {hl&&<span className="text-[10px] text-[#F7DA11] border border-[#F7DA11]/40 rounded px-1 py-0.5">drill →</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-white/50 font-mono text-sm">{formatIndian(dept.budget)}</TableCell>
                        <TableCell className="text-right text-white font-mono text-sm">{formatIndian(dept.actual)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${dept.variance>=0?"text-emerald-400":"text-red-400"}`}>{dept.variance>=0?"+":""}{formatIndian(dept.variance)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {drillLevel==="lineitem"&&lineItems.length>0&&(
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={lineItems} margin={{top:5,right:5,left:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="lineItem" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}}/>
                  <YAxis tickFormatter={(v:number)=>formatIndian(v)} tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} width={80}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="budget" name="Budget" fill={C.muted}   radius={[3,3,0,0]}/>
                  <Bar dataKey="actual" name="Actual" fill={C.yellow}  radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/50">Line Item</TableHead>
                    <TableHead className="text-white/50 text-right">Budget</TableHead>
                    <TableHead className="text-white/50 text-right">Actual</TableHead>
                    <TableHead className="text-white/50 text-right">Variance</TableHead>
                    <TableHead className="text-white/50">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map(li=>(
                    <TableRow key={li.id} className="border-white/5">
                      <TableCell className="font-medium text-white/80">{li.lineItem}</TableCell>
                      <TableCell className="text-right text-white/50 font-mono text-sm">{formatIndian(li.budget)}</TableCell>
                      <TableCell className="text-right text-white font-mono text-sm">{formatIndian(li.actual)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${li.variance>=0?"text-emerald-400":"text-red-400"}`}>{li.variance>=0?"+":""}{formatIndian(li.variance)}</TableCell>
                      <TableCell className="text-white/40 text-xs">{li.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
