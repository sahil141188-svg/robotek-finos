
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

const kpis:KPI[]=[
  {id:"revenue",  label:"Total Revenue",     value:14250000000,prev:12800000000,unit:"crore", goodWhenUp:true },
  {id:"ebitda",   label:"EBITDA",            value:2840000000, prev:2410000000, unit:"crore", goodWhenUp:true },
  {id:"ebitda_m", label:"EBITDA Margin",     value:19.9,       prev:18.8,       unit:"pct",   goodWhenUp:true },
  {id:"cash",     label:"Cash",              value:5460000000, prev:6120000000, unit:"crore", goodWhenUp:true },
  {id:"burn",     label:"Monthly Burn",      value:420000000,  prev:390000000,  unit:"crore", goodWhenUp:false},
  {id:"runway",   label:"Cash Runway",       value:13,         prev:15.7,       unit:"months",goodWhenUp:true },
  {id:"ar_days",  label:"AR Days",           value:47,         prev:52,         unit:"months",goodWhenUp:false},
  {id:"gross_m",  label:"Gross Margin",      value:54.2,       prev:51.6,       unit:"pct",   goodWhenUp:true },
];

const plTrend=MONTHS.map((m,i)=>({month:m,revenue:Math.round((110+i*2.8+Math.sin(i)*3)*1e7),expenses:Math.round((88+i*1.9+Math.cos(i)*2)*1e7),ebitda:Math.round((22+i*0.9+Math.sin(i))*1e7)}));
const cashFlowData=MONTHS.map((m,i)=>({month:m,operating:Math.round((18+Math.sin(i*.8)*4)*1e7),investing:Math.round((-8-Math.cos(i*.5)*2)*1e7),financing:Math.round((2+Math.sin(i*1.2))*1e7)}));
const segmentData=[{name:"Robotics",revenue:5800000000},{name:"Software",revenue:4120000000},{name:"Services",revenue:2870000000},{name:"Training",revenue:1460000000}];

const summaryRows:SummaryRow[]=[
  {id:"rev",  category:"Revenue",           budget:1500000000,actual:1425000000,variance: -75000000,variancePct:-5.0 },
  {id:"cogs", category:"Cost of Goods Sold",budget: 680000000,actual: 653000000,variance:  27000000,variancePct: 3.9 },
  {id:"gross",category:"Gross Profit",      budget: 820000000,actual: 772000000,variance: -48000000,variancePct:-5.8 },
  {id:"opex", category:"Operating Expenses",budget: 520000000,actual: 548000000,variance: -28000000,variancePct:-5.3 },
  {id:"ebit", category:"EBIT",              budget: 300000000,actual: 224000000,variance: -76000000,variancePct:-25.3},
  {id:"tax",  category:"Tax",               budget:  80000000,actual:  67000000,variance:  13000000,variancePct:16.2 },
  {id:"pat",  category:"Profit After Tax",  budget: 220000000,actual: 157000000,variance: -63000000,variancePct:-28.6},
];

const deptRows:Record<string,DeptRow[]>={
  opex:[
    {id:"eng",  department:"Engineering", budget:180000000,actual:212000000,variance:-32000000},
    {id:"sales",department:"Sales & Mktg",budget:140000000,actual:158000000,variance:-18000000},
    {id:"gna",  department:"G&A",         budget:120000000,actual:111000000,variance:  9000000},
    {id:"rd",   department:"R&D",         budget: 80000000,actual: 67000000,variance: 13000000},
  ],
  cogs:[
    {id:"mfg",department:"Manufacturing",budget:420000000,actual:401000000,variance:19000000},
    {id:"log",department:"Logistics",    budget:160000000,actual:154000000,variance: 6000000},
    {id:"qc", department:"Quality",      budget:100000000,actual: 98000000,variance: 2000000},
  ],
};

const lineItemRows:Record<string,LineItemRow[]>={
  eng:[
    {id:"sal", lineItem:"Salaries",         budget:120000000,actual:145000000,variance:-25000000,notes:"2 senior hires above band"},
    {id:"soft",lineItem:"Software Licenses",budget: 30000000,actual: 38000000,variance: -8000000,notes:"AWS cost spike Q2"},
    {id:"cont",lineItem:"Contractors",      budget: 30000000,actual: 29000000,variance:  1000000,notes:"On track"},
  ],
  sales:[
    {id:"adv",lineItem:"Advertising",budget:60000000,actual:72000000,variance:-12000000,notes:"Campaign extended"},
    {id:"evt",lineItem:"Events",     budget:40000000,actual:49000000,variance: -9000000,notes:"Expo overrun"},
    {id:"com",lineItem:"Commissions",budget:40000000,actual:37000000,variance:  3000000,notes:"Deal slippage"},
  ],
  mfg:[
    {id:"rm", lineItem:"Raw Materials",budget:280000000,actual:264000000,variance: 16000000,notes:"Supplier discount"},
    {id:"lab",lineItem:"Labour",       budget:100000000,actual:102000000,variance: -2000000,notes:"Overtime"},
    {id:"ovh",lineItem:"Overhead",     budget: 40000000,actual: 35000000,variance:  5000000,notes:"Efficiency gain"},
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
