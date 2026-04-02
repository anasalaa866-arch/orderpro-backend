<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OrderPro — نظام إدارة الطلبات</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --primary:#0f172a;--accent:#6366f1;--accent-h:#4f46e5;--accent-light:#eef2ff;
  --success:#10b981;--success-light:#d1fae5;--warn:#f59e0b;--warn-light:#fef3c7;
  --danger:#ef4444;--danger-light:#fee2e2;--info:#3b82f6;--info-light:#dbeafe;
  --purple:#8b5cf6;--purple-light:#ede9fe;
  --bg:#f1f5f9;--card:#ffffff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;
  --sidebar-w:240px;--topbar-h:58px;
}
html,body{height:100%;overflow:hidden}
body{font-family:Cairo,sans-serif;background:var(--bg);color:var(--text);font-size:13px}
.app{display:flex;height:100vh}
.sidebar{width:var(--sidebar-w);background:var(--primary);display:flex;flex-direction:column;flex-shrink:0}
.main-area{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{height:var(--topbar-h);background:#ffffff;border-bottom:2px solid #3ab877;display:flex;align-items:center;padding:0 20px;gap:10px;flex-shrink:0;font-family:'Roboto',sans-serif}
.content{flex:1;overflow-y:auto;padding:20px}
.sb-logo{padding:20px 18px 16px;border-bottom:1px solid rgba(255,255,255,.07)}
.sb-logo-inner{display:flex;align-items:center;gap:10px}
.sb-icon{width:36px;height:36px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px}
.sb-logo h2{font-size:16px;font-weight:800;color:#fff}
.sb-logo p{font-size:10px;color:rgba(255,255,255,.35);margin-top:1px}
.sb-nav{padding:12px 10px;flex:1;overflow-y:auto}
.nav-label{font-size:9px;font-weight:700;color:rgba(255,255,255,.3);padding:10px 14px 4px;text-transform:uppercase;letter-spacing:.1em;font-family:Roboto,sans-serif}
.ni{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:4px;cursor:pointer;color:rgba(255,255,255,.6);font-size:13px;font-weight:400;transition:all .15s;margin-bottom:2px;font-family:'Roboto',sans-serif;letter-spacing:.01em}
.ni:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.85)}
.ni.active{background:var(--accent);color:#fff;font-weight:600}
.ni-icon{font-size:16px;width:20px;text-align:center;flex-shrink:0}
.ni-label{flex:1}
.nbadge{background:var(--danger);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;min-width:18px;text-align:center}
.nbadge.orange{background:var(--warn)}
.sb-foot{padding:12px 10px;border-top:1px solid rgba(255,255,255,.07)}
.sb-status{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04)}
.sdot{width:7px;height:7px;border-radius:50%;background:var(--danger);flex-shrink:0}
.sdot.on{background:var(--success);box-shadow:0 0 0 2px rgba(16,185,129,.3)}
.sb-status-text{font-size:11px;color:rgba(255,255,255,.4)}
.topbar-title{font-size:16px;font-weight:700;flex:1}
.search-wrap{position:relative}
.search-wrap input{padding:7px 12px 7px 34px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:Cairo,sans-serif;color:var(--text);background:var(--bg);outline:none;width:200px;transition:border .15s}
.search-wrap input:focus{border-color:var(--accent);background:#fff}
.search-ic{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:Cairo,sans-serif;transition:all .15s;white-space:nowrap}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent-h)}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}.btn-ghost:hover{background:var(--bg)}
.btn-success{background:var(--success);color:#fff}
.btn-sm{padding:5px 10px;font-size:11px;border-radius:6px}
.btn-xs{padding:3px 8px;font-size:10px;border-radius:5px}
.page{display:none}.page.active{display:block}
.stats-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
.sc{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;position:relative;overflow:hidden}
.sc::before{content:'';position:absolute;top:0;right:0;width:4px;height:100%;border-radius:0 12px 12px 0}
.sc.blue::before{background:var(--accent)}.sc.green::before{background:var(--success)}.sc.orange::before{background:var(--warn)}.sc.red::before{background:var(--danger)}.sc.purple::before{background:var(--purple)}
.sc-icon{font-size:22px;margin-bottom:8px}.sc-label{font-size:11px;color:var(--muted);font-weight:600;margin-bottom:4px}.sc-val{font-size:22px;font-weight:800}.sc-sub{font-size:10px;color:var(--muted);margin-top:3px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px}
.card-hd{padding:13px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}
.card-hd h3{font-size:13px;font-weight:700}
.card-body{padding:16px}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{padding:9px 13px;text-align:right;font-size:11px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--border);background:#fafafa;white-space:nowrap}
td{padding:10px 13px;border-bottom:1px solid var(--border);font-size:12px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#fafbff}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
.b-new{background:var(--purple-light);color:#5b21b6}.b-wait{background:var(--warn-light);color:#92400e}
.b-go{background:var(--success-light);color:#065f46}.b-done{background:#dcfce7;color:#14532d}
.b-cancel{background:var(--danger-light);color:#7f1d1d}.b-shopify{background:#e8f5e9;color:#1b5e20}.b-manual{background:var(--info-light);color:#1e3a5f}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:4px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;font-size:11px;cursor:pointer;font-family:Cairo,sans-serif;color:var(--muted);transition:all .15s;font-weight:600}
.chip:hover{border-color:var(--accent);color:var(--accent)}.chip.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.cgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px}
.cc{border:1px solid var(--border);border-radius:10px;padding:14px;transition:all .2s}
.cc:hover{border-color:var(--accent);box-shadow:0 0 0 3px rgba(99,102,241,.1)}
.cc.selected{border-color:var(--success);box-shadow:0 0 0 3px rgba(16,185,129,.15)}
.cc-av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#fff;margin-bottom:10px}
.cc-name{font-weight:700;font-size:13px;margin-bottom:3px}.cc-info{font-size:11px;color:var(--muted);margin-bottom:2px}
.cc-status{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;margin-top:7px;padding:3px 9px;border-radius:10px}
.s-active{background:var(--success-light);color:#065f46}.s-busy{background:var(--warn-light);color:#92400e}
.pbar{height:5px;background:var(--border);border-radius:3px;margin-top:7px;overflow:hidden}
.pbar-f{height:100%;border-radius:3px;background:var(--success)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(2px)}
.overlay.open{opacity:1;pointer-events:all}
.modal{background:var(--card);border-radius:16px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,.2);transform:translateY(14px);transition:transform .25s}
.overlay.open .modal{transform:none}
.mhd{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--card);z-index:1}
.mhd h3{font-size:14px;font-weight:700}
.mbd{padding:20px}.mft{padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:var(--card)}
.xbtn{width:28px;height:28px;border-radius:50%;background:var(--bg);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px}
.xbtn:hover{background:var(--border)}
.fg{margin-bottom:13px}
.fg label{display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:5px}
.fg input,.fg select,.fg textarea{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:Cairo,sans-serif;color:var(--text);outline:none;background:var(--card);transition:border .15s}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--accent)}
.fg textarea{resize:vertical;min-height:70px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.acc-tabs{display:flex;gap:2px;background:var(--bg);border-radius:9px;padding:4px;margin-bottom:16px}
.acc-tab{flex:1;text-align:center;padding:7px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;color:var(--muted);transition:all .15s}
.acc-tab.on{background:var(--card);color:var(--accent);box-shadow:0 1px 4px rgba(0,0,0,.08)}
.acc-sec{display:none}.acc-sec.on{display:block}
.acc-hl{background:var(--accent-light);border-top:2px solid var(--accent)}
.acc-hl td{color:var(--accent);font-weight:700}
.mpos{color:var(--success);font-weight:700}.mwarn{color:var(--warn);font-weight:700}.mpurp{color:var(--purple);font-weight:700}
.nitem{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
.nitem:hover{background:var(--bg)}.nitem.unread{background:#f8f9ff}.nitem:last-child{border-bottom:none}
.nicon{font-size:20px;flex-shrink:0;margin-top:2px}.nbody{flex:1}
.ntitle{font-size:12px;font-weight:700;margin-bottom:2px}.nsub{font-size:11px;color:var(--muted)}.ntime{font-size:10px;color:var(--muted);white-space:nowrap}
.ndot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.srow{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--bg)}
.srow:last-child{border-bottom:none}
.sinfo h4{font-size:13px;font-weight:600;margin-bottom:2px}.sinfo p{font-size:11px;color:var(--muted)}
.toggle{width:38px;height:22px;border-radius:11px;background:var(--border);cursor:pointer;position:relative;transition:background .2s}
.toggle.on{background:var(--success)}
.toggle::after{content:'';position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.toggle.on::after{transform:translateX(-16px)}
.banner{border-radius:12px;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;color:#fff}
.banner.disc{background:linear-gradient(135deg,#6366f1,#8b5cf6)}.banner.conn{background:linear-gradient(135deg,#10b981,#059669)}
.banner h4{font-size:14px;font-weight:800;margin-bottom:3px}.banner p{font-size:11px;opacity:.8}
.settle-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:var(--bg);border-radius:10px;padding:14px;margin-bottom:16px;text-align:center}
.settle-n{font-size:20px;font-weight:800}.settle-l{font-size:10px;color:var(--muted);margin-top:2px}
.uitem{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)}
.uitem:last-child{border-bottom:none}
.uav{width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.api-badge{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid var(--border)}
.api-badge.ok{background:var(--success-light);color:#065f46;border-color:#86efac}
.api-badge.fail{background:var(--danger-light);color:#7f1d1d;border-color:#fca5a5}
.api-badge.wait{background:var(--warn-light);color:#92400e;border-color:#fcd34d}
.wstep{display:flex;gap:14px;padding:14px 20px;border-bottom:1px solid var(--border);align-items:flex-start}
.wstep:last-child{border-bottom:none}
.wnum{width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;margin-top:2px}
.wnum.done{background:var(--success)}
.wbody h4{font-size:13px;font-weight:700;margin-bottom:4px}.wbody p{font-size:12px;color:var(--muted);line-height:1.7}
.wcode{background:#1e293b;color:#7dd3fc;padding:8px 14px;border-radius:7px;font-family:monospace;font-size:12px;margin:8px 0;word-break:break-all;cursor:pointer}
.wcode:hover{background:#263548}
.wnote{background:var(--warn-light);border:1px solid #fcd34d;border-radius:7px;padding:8px 12px;font-size:12px;color:#92400e;margin:6px 0}
/* ===== DELIVERY SHEET ===== */
.ds-wrap{background:var(--bg);padding:0}
.ds-ctrl{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;background:var(--card);padding:12px 16px;border-radius:12px;border:1px solid var(--border)}
.ds-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--muted);transition:all .15s;font-family:Cairo,sans-serif}
.ds-btn:hover{background:var(--bg)}
.ds-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.ds-btn.exp-btn{border-color:#fca5a5;color:var(--danger)}
.ds-btn.exp-btn.active{background:var(--danger-light);color:#7f1d1d;border-color:#fca5a5}
.ds-btn.zone-btn{border-color:#fcd34d;color:var(--warn)}
.ds-btn.zone-btn.active{background:var(--warn-light);color:#92400e;border-color:#fcd34d}
.ds-btn.print-btn{background:var(--primary);color:#fff;border-color:var(--primary);margin-right:auto}
.ds-btn.print-btn:hover{background:#1e293b}
.zone-picker{display:none;gap:6px;flex-wrap:wrap;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:12px}
.zone-picker.visible{display:flex;align-items:center}
.zpill{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--border);color:var(--muted);background:transparent;font-family:Cairo,sans-serif;transition:all .15s}
.zpill.zone-other{background:#fef3c7;color:#92400e;border-color:#f59e0b}
.zpill:hover{border-color:var(--warn);color:var(--warn)}
.zpill.on{background:var(--warn-light);color:#92400e;border-color:#fcd34d}
.ds{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px}
.ds-hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid var(--text);margin-bottom:16px}
.ds-title{font-size:16px;font-weight:700;color:var(--text)}
.ds-sub{font-size:11px;color:var(--muted);margin-top:3px}
.ds-courier-name{font-size:15px;font-weight:700;color:var(--text);text-align:right}
.ds-date{font-size:11px;color:var(--muted);text-align:right;margin-top:3px}
.ds-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.ds-sbox{background:var(--bg);border-radius:8px;padding:10px 12px;text-align:center}
.ds-snum{font-size:18px;font-weight:800}
.ds-slbl{font-size:10px;color:var(--muted);margin-top:2px}
.ds-sec{display:flex;align-items:center;gap:10px;margin:8px 0}
.ds-sec-line{flex:1;height:0.5px;background:var(--border)}
.ds-sec-lbl{font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px}
.dsl-exp{background:var(--danger-light);color:#7f1d1d}
.dsl-norm{background:var(--info-light);color:#1e3a5f}
.ds-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;table-layout:fixed}
.ds-table th{padding:5px 7px;text-align:right;font-size:10px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--border);background:var(--bg);white-space:nowrap}
.ds-table td{padding:5px 7px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text)}
.ds-table tr:last-child td{border-bottom:none}
.ds-table tr.ds-er td{background:#fff5f5}
.ds-table tr.ds-nr:nth-child(even) td{background:var(--bg)}
.ds-zone-hdr td{padding:5px 10px 3px!important;background:var(--bg)!important}
.ds-onum{font-weight:700;font-size:13px}
.ds-cname{font-weight:700;font-size:12px}
.ds-cphone{font-size:11px;color:var(--muted);margin-top:2px;direction:ltr;text-align:right}
.ds-area{display:inline-block;background:var(--warn-light);color:#92400e;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
.ds-addr{font-size:11px;line-height:1.7}
.ds-cod{font-size:13px;font-weight:700;color:var(--success)}
.ds-paid{background:var(--success-light);color:#065f46;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;display:inline-block}
.ds-chk{width:18px;height:18px;border:1.5px solid var(--border);border-radius:4px;margin:0 auto}
.ds-foot{margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.ds-trow{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--muted)}
.ds-trow.big{font-size:14px;font-weight:700;color:var(--text);border-top:1px solid var(--border);padding-top:8px;margin-top:6px}
.ds-trow.big span:last-child{color:var(--success)}
.ds-sig-line{height:36px;border-bottom:1px solid var(--text);margin-bottom:5px}
.ds-sig-lbl{font-size:10px;color:var(--muted);text-align:center}
.ds-meta{margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}
.ds-mode-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:4px}
.ds-mb-full{background:var(--info-light);color:#1e3a5f}
.ds-mb-exp{background:var(--danger-light);color:#7f1d1d}
.ds-mb-zone{background:var(--warn-light);color:#92400e}
@media print{
  .sidebar,.topbar,.ds-ctrl,.zone-picker{display:none!important}
  .main-area{overflow:visible!important;height:auto!important}
  .content{padding:0!important;overflow:visible!important;height:auto!important}
  .ds{border:none;border-radius:0;box-shadow:none;overflow:visible!important}
  .ds-table{page-break-inside:auto!important;width:100%!important}
  .ds-table tr{page-break-inside:avoid;page-break-after:auto}
  .ds-table thead{display:table-header-group}
  .ds-foot{page-break-inside:avoid}
  .ds-sec{page-break-after:avoid}
  body{background:#fff!important;overflow:visible!important}
  *{overflow:visible!important}
}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(80px);background:#1e293b;color:#fff;padding:11px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:9999;transition:transform .3s;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:400px}
.toast.show{transform:translateX(-50%) translateY(0)}
@media(max-width:900px){.stats-row{grid-template-columns:repeat(2,1fr)}.cgrid{grid-template-columns:repeat(2,1fr)}.sg{grid-template-columns:1fr}.sidebar{width:64px}.sb-logo h2,.sb-logo p,.ni-label,.nbadge,.nav-label,.sb-status-text{display:none}.sb-logo-inner{justify-content:center}.ni{justify-content:center;padding:10px}.sb-status{justify-content:center}}

/* ===== LOGIN SCREEN ===== */
#login-screen{position:fixed;inset:0;background:#0d0d0d;z-index:9999;display:flex;align-items:center;justify-content:center}
#login-screen.hidden{display:none}
.login-box{background:#fff;border-radius:12px;padding:36px 32px;width:360px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.login-logo{text-align:center;margin-bottom:24px}
.login-logo img{width:160px;height:auto}
.login-logo p{font-size:11px;color:#999;margin-top:6px;letter-spacing:.08em;text-transform:uppercase;font-family:Roboto,sans-serif}
.login-field{margin-bottom:14px}
.login-field label{display:block;font-size:12px;font-weight:600;color:#333;margin-bottom:5px;font-family:Roboto,sans-serif}
.login-field input{width:100%;padding:10px 14px;border:1.5px solid #e0e0e0;border-radius:8px;font-family:Roboto,sans-serif;font-size:14px;outline:none;transition:.15s;box-sizing:border-box}
.login-field input:focus{border-color:#3ab877}
.login-btn{width:100%;padding:11px;background:#3ab877;color:#fff;border:none;border-radius:8px;font-family:Roboto,sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px;transition:.15s}
.login-btn:hover{background:#2d9a63}
.login-err{color:#e53e3e;font-size:12px;text-align:center;margin-top:8px;min-height:18px;font-family:Roboto,sans-serif}
.login-ver{font-size:10px;color:#ccc;text-align:center;margin-top:14px;font-family:Roboto,sans-serif}

</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
</head>
<body>

<!-- ===== LOGIN SCREEN ===== -->
<div id="login-screen">
  <div class="login-box">
    <div class="login-logo">
      <img src="data:image/png;base64,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" alt="CAFELAX" style="filter:invert(0)">
      <p>Order Management System</p>
    </div>
    <div class="login-field">
      <label>اسم المستخدم</label>
      <input type="text" id="login-username" placeholder="أدخل اسم المستخدم" onkeydown="if(event.key==='Enter')doLogin()">
    </div>
    <div class="login-field">
      <label>كلمة المرور</label>
      <input type="password" id="login-password" placeholder="أدخل كلمة المرور" onkeydown="if(event.key==='Enter')doLogin()">
    </div>
    <div class="login-err" id="login-err"></div>
    <button class="login-btn" onclick="doLogin()">تسجيل الدخول</button>
    <div class="login-ver">CAFELAX OrderPro v2.0</div>
  </div>
</div>


<div class="app" id="main-app" style="display:none">

<aside class="sidebar">
  <div class="sb-logo">
    <div style="padding:16px 14px 14px;border-bottom:1px solid rgba(58,184,119,.2);margin-bottom:6px;text-align:center">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAClcAAANxCAYAAABzen1eAAABCmlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGBckZOcW8wkwMCQm1dSFOTupBARGaXAfoeBkUGSgZlBk8EyMbm4wDEgwIcBJ/h2DagaCC7rgszCrQ4r4ExJLU4G0h+AOD65oKiEgYERZBdPeUkBiB0BZIsUAR0FZOeA2OkQdgOInQRhTwGrCQlyBrJ5gGyHdCR2EhIbahcIsCYbJWciOyS5tKgMypQC4tOMJ5mTWSdxZHN/E7AXDZQ2UfyoOcFIwnqSG2tgeezb7IIq1s6Ns2rWZO6vvXz4pcH//yWpFSUgzc7OBgygMEQPG4RY/iIGBouvDAzMExBiSTMZGLa3MjBI3EKIqSxgYOBvYWDYdh4A8P1N247YzPkAADTkSURBVHic7NzRkqO6FYZRK8X7v7JykaTqzznd1hxj2BJa65aanj1jEDT+Sq33/gIAAAAAAAAAAADgP/5VPQAAAAAAAAAAAADATMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABCO6gFgcr16gMm16gEAHmr2+4/1H/jU7OsbnOH+uDfrGzuz/vHO7Ouj8xeAK7j/AVWsPzAv1+ei7FwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEFrvvXoGeMcJyjutegCAX7h/vWf9hnVZ3+Bz7n9rs/7B56x/a9t9/XP+Auxp9/vfiPsjXMf68571h5ntfv0+9vq0cyUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAaL336hlYmxOIJ2vVAwDTcv+7lvUX6ljfoI77Xy3rH9Sx/tWy/p3j/AVYk/vfOe5/cB3r0znWJ67k+jxn2evTzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4agegHK9egCY2Nnro31lCgCA7/H8D/MaXZ9+vzjH+gfzsv6xMucvADty/4PPeT8B83J9XmvZ5wc7VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3oALterB4CNja6/dssUwCfcP2tZPwEAAL7D77cA7Mj9r5b3u0AV6w/wdXauBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAhH9QAM9eoBgMucvb7bV6YAAABWMPr9we8HAAAAALX0HXPzfm1vrk8+YudKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgHBUD8CrVw8ALGu0frRbpgC4n/UPAAAAAPbl+1UA4K88H3AJO1cCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAAhKN6gA306gGAbY3Wn3bLFDAn92cAAAAAALif76+AWVmf5ub7XUrYuRIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgHNUDPECvHgAAAAB4vFY9AAAAwE18/wqsavT+xvq2ttHn5/0dPJCdKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAADCUT3AAnr1AAAXGa1v7ZYp4Bru33uzvgEAAAAArMn7XYA9+X6XKdm5EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACAc1QNMoFcPAAAAAGyvVQ8AUMT6BwAAwBOM+qPdf//VZ+1t2fPfzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4age4Aa9egAA4Ovc3zljdP60W6YAAIA9eL4GAP7K+13O8H6XlY3OT+vjs1m/eLLHnr92rgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAIR/UAAAAAAA/QqgcAKGL9AwAA+I7R71f9lingM85PHsnOlQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAADhqB7gC3r1APBGqx5gwPWzt9nPT/ZmfaLS6PyzfgKfsn4Au7L+AQDsxftdAPjnZv9+yv19b9XnXxk7VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3oAKNaqByh29b+/X/zzAQAAAAAAAP5n9P3k7t8Ps7bR+ev7+WezvnEl588v7FwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEI7qAf5Arx6AqbXqAXjr7Ofj+j/H9QFwjdH9yfoLAAAAwJP5/gZgTqPvJ6zfz3b2+yvnB/zAzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4ageAAZa9QCUGn3+/ZYp5uX6YGW7X78AAAAAAMD9Rt9P+P6NJ/P9+958vntzf/uQnSsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAwlE9wOv16tUDcKlWPQCPdvX5dfX65PoAAAAAAAAAAOAM/clF7FwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEI7qAQAm1qoHgIX16gGg0Oj8d38BAAAAYGbe77Iz73fZ2ej8dn8AtmPnSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIBw3PB39Bv+Duq06gEAAAAAAAAAALjUqA/RB8F19FlF7FwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEI7qAZheqx4AgCn16gFgYaPrx/MXAAAAAFfyfhcAYC6+H5yUnSsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAwlE9AOVa9QAAAAAAAAAAsIA+OO77d3Y2Ov9H1w/AdOxcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABCO6gEAAID/0wfH2y1TAAAAALCq0fslAKgw+n7D/Ysn8/3eouxcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABCO6gEAgCn16gE4pQ2O+3wBalh/9za6P8OTWf+ezfoGAPBd3u+ubfT5eH4GeCbr+0PZuRIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgHF/4Gf0LP4PrtOoBAAAAgOH7E7+/A6uyvgHA/Xw/uzbPRwA/G62P7n/A7excCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABCO6gEAgBK9egBOaRf/eefH3Eafz9nzAwAAvsnzKwDAd3m/uzbPx/A56x+VrM+bsnMlAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQDiqBwAAAADg1QfH2y1TAAAAAADsx/tXfmTnSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIBwVA8AAFyiVw/AKW3yv9/5NbfR51N9fgEAQPL8CgB/5/3b2jy/ANTw/RbwdXauBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAhH9QAAAAAAAAAAwFe0wfF+yxR8avT5jD5fAH5m/eQjdq4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACEf1AAAALKcNjvdbpuBTo89n9PkCAMA3ef4EYEfen63N8wsArMf3Y3zEzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4ageAAD4SK8egFNa9QAAAAAAAGxp9H7a9w9zG30+vn9gZ9YvzrC+8iM7VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3oAAAAAAF6tegAAAOBrevUAnOL3M4A5ub8Ct7NzJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEA4qgcAAH7UqwfglFY9QLHRv9/5PbfR57P7+Q0AwD/j+REAYC3e767N+12Aa1hfN2XnSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIBwfOFntMHx/oW/g8+N/v9Hnx8AAAAw5vdrYFfWPwAAAL5BX8TK9FkPZedKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgHBUDwAAm+rVA3BKqx5gcaP/P9fH3Eafj+sDfuf6AHZl/QMAnsb7q7V5Pj3H+921eb9LJesDsBw7VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3oAyvXB8XbLFAAAAAAAAAAAAM+jz1qUnSsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAwlE9AAA8VK8egEv5fOF3o+uj3TIFAAAAwOe8/3s2ny/ANayv8Dnfr03KzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4agegOn1wfF2yxQAAAAAAAAAwJX0AbwzOj8AHsfOlQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAADhuOHvaIPj/YYZuM7o8xt9/gAAAAAAAHAn308CwN+5P8K89FlF7FwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEI7qAQAm1i/++e3in8+1rj4/AJ5qtH66PwIAAAAAzMn7XYA5WZ8vYudKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgHBUD/B6vdrgeL9lCq5y9vMbnR/sbfX1wfUBAAAAAAAAwB1W/36dc/RZ8AE7VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3oAGOiD4+2WKagy+vx35/q4lvMPoIb7GwAAAHCW97sANbzfreX+tzfXF+9Ynz9k50oAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAcFQP8Afa4Hi/ZQpmdfbzH51fnOP6rDX6/3f+AwAAAAAAAMD8rv5+X5+1N33JL+xcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABCO6gGgWL/457eLf/5ZV//7YWbOf4A1jdbv2Z+/AAAAgPO83wVgR+5/VBp9/+L85JHsXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQjuoBvqANjvdbpoCfOf+Y2ej8HK2vAAAA8Ce8H3k27w/gd9a/Z7P+AcA/5/vJ9zw/7m3385+5bbt+27kSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIBzVAwAAAHxRHxxvt0wBALAPz1/Arkbr34j18b2z/78AALN5+vPf6N/n+e7ZHvt+yM6VAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAOGoHuAGbXC83zIFAHezvgMAAEC90e/no/e3AE9lfQSAv3v6/dH3l+xMv8WS7FwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEI7qASbQBsf7LVMA3G+0/kEl5ycz83wIAADfM3q+9vshwDN5v/Js7t/MzPoDXMX9D3637PsfO1cCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAAhKN6gAW0wfF+yxQA/JX1d22j+yvMzPPh2kafj/UJAACAGfj9lZk5/1iZ97tcyfnzbO5/17I+MyU7VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3qAB2iD4/2WKQAAAAAAAAAAnmvUX4z6DWBd+ixK2LkSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIBzVA2ygDY73W6YAdjRaf+BKzj925vkPAAAAgJV5vwvAjtz/1ub7OS5h50oAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAcFQPwKsNjvdbpgBWNFo/AAAAAAAAgD/n+3t4Lt+vA/+YnSsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAwlE9AEPt5J/vX5kCuMLZ6xuANY3Wf89vAAAAgPfHXMn5BazK+gV8yvdzfMTOlQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAADhqB6Ay7XB8X7LFLCn0fXHOda3Ws5vYFW7r1/unwAAe/H8B8zK+gSsyvrFO86PWru//+cc1y8/snMlAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQDiqB6BcO/nn+1emgDmdvT4A4BOj+4/nL5iX50eYl/srzMv9E9iV9Y8rOb+AVVm/eMf5Aeta9vq1cyUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAaL336hngHSco77TqAVia9eU91xesa/f1zfp1LecXsKvd1z84w/1zbdY/+Jz171q7r0/OL1iX9Yt3nB+wLtfvQ9m5EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACC03nv1DDAzF8h7rXoAKDT7+uD6BH5j/aJS9fnn/AKqVK9/cIb7J2dY/1iZ9e/Zqtcn5xfwKesX7zg/YF2u30nZuRIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgtN579QwAAAAAAAAAAAAA07BzJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEA4qgcAAAAAAACYUD/559tXpgAAAABK2LkSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIBzVAwAAAAAAABTo1QMAAAAA87JzJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEA4qgcAAAAAuEE/+efbV6YAAO509v5/9d/v+QIAAAAmZudKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgHBUDwAAAMBt+uB4u2UKWJPrBwDmM7o/AwAAAHzMzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4ageAAAAgK/pF//5dvLnw5Odvf5cXwDs6Oz9EwAAAOAydq4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACEf1AAAAACyjD463W6aAZxpdXyOuPwAqnL1/AQAAAEzLzpUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAA4ageAAAAgD/WqwcYGM3XbpkC9nT1+uD6BXim2Z8v4R2/fwAAAHApO1cCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAAhKN6AAAAALbRB8fbLVOwq9H5NTo/d3f1/4/rH9iV+w9cx+8fAAAAnGLnSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIBwVA8AAAAA/9UHx9stU7Cr0fk1Oj85p/r/1/oC+6pef3g295dzXJ8AAACUsnMlAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQGi99+oZAAAA+DN+gTunVQ/Ao7k+mZn1jzOsb/A76+s5s68vPl8AAIDN2bkSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIBzVAwAAAMBN+uB4u2UKnmp0/ozOP7iS8w/gM54Pz3H/AQAAYGl2rgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAIR/UAAAAA/LE2ON5vmeK5zv7/jT4f9ub6BYD7eT67lucXAAAAHs3OlQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAADhqB4AAAAAHqKf/PPtK1OwqrOf/9nzDwBm5PnoWp4fAAAA4A07VwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAACEo3oAAAAA4PV6vV795J9vX5mCVV39+Z89PwHYk+eTWu7fAAAAcIKdKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAADCUT0AAAAAX9MGx/stU1Dl7Oc7On/Y29Xnh/UJ4Bru72tzfwQAAIBCdq4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACEf1AAAAAMAU+sU/v13881lb9flx9fkP7Kt6faOW+wsAAAAszM6VAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAOGoHgAAAIDbtMHxfssU7Ors+TU6f+GMp59f1ndW9vTrk1rWRwAAAOBXdq4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAIK4EAAAAAAAAAAAACEf1AAAAAEyjDY73W6aAn1Wff6PrA2bm/AVWVX3/BwAAADZm50oAAAAAAAAAAACAIK4EAAAAAAAAAAAACOJKAAAAAAAAAAAAgCCuBAAAAAAAAAAAAAjiSgAAAAAAAAAAAIAgrgQAAAAAAAAAAAAI4koAAAAAAAAAAACAcFQPAAAAwDLa4Hi/ZQqoUX1+j64/AKhQfX+EMzxfAQAA8JadKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACCIKwEAAAAAAAAAAADCUT0AAAAAj9EGx/stU8AzVV8/o+sbgBrV9wcAAACAx7JzJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEA4qgcAAABgG21wvN8yBfCJ1a/P0foD7Gv19Q34nfs/AAAAp9i5EgAAAAAAAAAAACCIKwEAAAAAAAAAAACCuBIAAAAAAAAAAAAgiCsBAAAAAAAAAAAAgrgSAAAAAAAAAAAAIIgrAQAAAAAAAAAAAIK4EgAAAAAAAAAAACAc1QMAAADAf7XB8X7LFMATWT/OGa3PzM35DzyV+xMAAACXsnMlAAAAAAAAAAAAQBBXAgAAAAAAAAAAAARxJQAAAAAAAAAAAEAQVwIAAAAAAAAAAAAEcSUAAAAAAAAAAABAEFcCAAAAAAAAAAAABHElAAAAAAAAAAAAQDiqBwAAAIA/1E7++f6VKQD2Y/0EoMLZ538AAAA4xc6VAAAAAAAAAAAAAEFcCQAAAAAAAAAAABDElQAAAAAAAAAAAABBXAkAAAAAAAAAAAAQxJUAAAAAAAAAAAAAQVwJAAAAAAAAAAAAEMSVAAAAAAAAAAAAAOGoHgAAAABu0gbH+y1TAAAAr9f4+RwAAABK2bkSAAAAAAAAAAAAIIgrAQAAAAAAAODf7dwxDqNAFAVBjzT3vzKbdrJarQB9G6py4EX2BK0BAIAQVwIAAAAAAAAAAACEuBIAAAAAAAAAAAAgxJUAAAAAAAAAAAAAIa4EAAAAAAAAAAAACHElAAAAAAAAAAAAQOzpAQAAAPAl1snnj0tWAADAM5w9XwMAAMAoN1cCAAAAAAAAAAAAhLgSAAAAAAAAAAAAIMSVAAAAAAAAAAAAACGuBAAAAAAAAAAAAAhxJQAAAAAAAAAAAECIKwEAAAAAAAAAAABCXAkAAAAAAAAAAAAQe3oAAAAAPMQ6+fxxyQoAALjG2fMtAAAA/DQ3VwIAAAAAAAAAAACEuBIAAAAAAAAAAAAgxJUAAAAAAAAAAAAAIa4EAAAAAAAAAAAACHElAAAAAAAAAAAAQIgrAQAAAAAAAAAAAEJcCQAAAAAAAAAAABB7egAAAADw+Xw+n3Xy+eOSFQAAvMXZ8ycAAAA8mpsrAQAAAAAAAAAAAEJcCQAAAAAAAAAAABDiSgAAAAAAAAAAAIAQVwIAAAAAAAAAAACEuBIAAAAAAAAAAAAgxJUAAAAAAAAAAAAAIa4EAAAAAAAAAAAAiD09AAAAALjEuvn9x83vBwDg/9x9/gMAAIBXc3MlAAAAAAAAAAAAQIgrAQAAAAAAAAAAAEJcCQAAAAAAAAAAABDiSgAAAAAAAAAAAIAQVwIAAAAAAAAAAACEuBIAAAAAAAAAAAAgxJUAAAAAAAAAAAAAsacHAAAAAD9hnXz+uGQFAMDvOHt+AgAAAAa5uRIAAAAAAAAAAAAgxJUAAAAAAAAAAAAAIa4EAAAAAAAAAAAACHElAAAAAAAAAAAAQIgrAQAAAAAAAAAAAEJcCQAAAAAAAAAAABDiSgAAAAAAAAAAAIDY0wMAAACAV1g3v/+4+f0AwPvcfX4BAAAAvpibKwEAAAAAAAAAAABCXAkAAAAAAAAAAAAQ4koAAAAAAAAAAACAEFcCAAAAAAAAAAAAhLgSAAAAAAAAAAAAIMSVAAAAAAAAAAAAACGuBAAAAAAAAAAAAIg9PQAAAADgAmv4+8fw9wHgjab//wEAAIAHc3MlAAAAAAAAAAAAQIgrAQAAAAAAAAAAAEJcCQAAAAAAAAAAABDiSgAAAAAAAAAAAIAQVwIAAAAAAAAAAACEuBIAAAAAAAAAAAAgxJUAAAAAAAAAAAAAsacHAAAAADzAGv7+Mfx9AN5p+v8PAAAA4DZurgQAAAAAAAAAAAAIcSUAAAAAAAAAAABAiCsBAAAAAAAAAAAAQlwJAAAAAAAAAAAAEOJKAAAAAAAAAAAAgBBXAgAAAAAAAAAAAIS4EgAAAAAAAAAAACD29AAAAAAATlvTA/7hmB4A8FDf/vsPAAAA8LPcXAkAAAAAAAAAAAAQ4koAAAAAAAAAAACAEFcCAAAAAAAAAAAAhLgSAAAAAAAAAAAAIMSVAAAAAAAAAAAAACGuBAAAAAAAAAAAAAhxJQAAAAAAAAAAAEDs6QEAAAAAPN6aHnCzY3oA8FdP//0BAAAA4CZurgQAAAAAAAAAAAAIcSUAAAAAAAAAAABAiCsBAAAAAAAAAAAAQlwJAAAAAAAAAAAAEOJKAAAAAAAAAAAAgBBXAgAAAAAAAAAAAIS4EgAAAAAAAAAAACD29AAAAAAA+HFregAAAAAAANdycyUAAAAAAAAAAABAiCsBAAAAAAAAAAAAQlwJAAAAAAAAAAAAEOJKAAAAAAAAAAAAgBBXAgAAAAAAAAAAAIS4EgAAAAAAAAAAACDElQAAAAAAAAAAAAAhrgQAAAAAAAAAAAAIcSUAAAAAAAAAAABAiCsBAAAAAAAAAAAAQlwJAAAAAAAAAAAAEOJKAAAAAAAAAAAAgBBXAgAAAAAAAAAAAIS4EgAAAAAAAAAAACDElQAAAAAAAAAAAAAhrgQAAAAAAAAAAAAIcSUAAAAAAAAAAABAiCsBAAAAAAAAAAAAQlwJAAAAAAAAAAAAEOJKAAAAAAAAAAAAgBBXAgAAAAAAAAAAAIS4EgAAAAAAAAAAACDElQAAAAAAAAAAAAAhrgQAAAAAAAAAAAAIcSUAAAAAAAAAAABAiCsBAAAAAAAAAAAAQlwJAAAAAAAAAAAAEOJKAAAAAAAAAAAAgBBXAgAAAAAAAAAAAIS4EgAAAAAAAAAAACDElQAAAAAAAAAAAAAhrgQAAAAAAAAAAACIP/qHo31TukenAAAAAElFTkSuQmCC" alt="CAFELAX" style="width:148px;height:auto;display:block;margin:0 auto">
      <div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:5px;font-family:Roboto,sans-serif;letter-spacing:.1em;text-transform:uppercase">Order Management</div>
    </div>
  </div>
  <nav class="sb-nav">
    <div class="nav-label">الرئيسية</div>
    <div class="ni active" data-p="dashboard" onclick="goPage(this,'dashboard')"><span class="ni-icon">🏠</span><span class="ni-label">لوحة التحكم</span></div>
    <div class="ni" data-p="orders" onclick="goPage(this,'orders')"><span class="ni-icon">📋</span><span class="ni-label">الطلبات</span><span class="nbadge" id="nb-orders">0</span></div>
    <div class="nav-label">التوصيل</div>
    <div class="ni" data-p="couriers" onclick="goPage(this,'couriers')"><span class="ni-icon">🚴</span><span class="ni-label">المناديب</span></div>
    <div class="ni" data-p="assign" onclick="goPage(this,'assign')"><span class="ni-icon">📍</span><span class="ni-label">توزيع الطلبات</span><span class="nbadge orange" id="nb-assign">0</span></div>
    <div class="ni" data-p="pickup" onclick="goPage(this,'pickup')"><span class="ni-icon">🏪</span><span class="ni-label">استلام من المحل</span><span class="nbadge" id="nb-pickup" style="background:var(--purple)">0</span></div>
    <div class="ni" data-p="transit" onclick="goPage(this,'transit')"><span class="ni-icon">🏭</span><span class="ni-label">مخزن العبور</span><span class="nbadge" id="nb-transit" style="background:var(--warn)">0</span></div>
    <div class="ni" data-p="bosta" onclick="goPage(this,'bosta')"><span class="ni-icon">🚚</span><span class="ni-label">بوسطة</span><span class="nbadge" id="nb-bosta" style="background:#6366f1">0</span></div>
    <div class="ni" data-p="delivery-sheet" onclick="goPage(this,'delivery-sheet')"><span class="ni-icon">🖨️</span><span class="ni-label">ورقة التوصيل</span></div>
    <div class="ni" data-p="courier-orders" onclick="goPage(this,'courier-orders')"><span class="ni-icon">🧑</span><span class="ni-label">طلبات المناديب</span></div>
    <div class="ni" data-p="import-excel" onclick="goPage(this,'import-excel')"><span class="ni-icon">📥</span><span class="ni-label">استيراد Excel</span></div>
    <div class="ni" data-p="problems" onclick="goPage(this,'problems')"><span class="ni-icon">⚠️</span><span class="ni-label">طلبات مشكلة</span><span class="nbadge" id="nb-problems" style="background:var(--danger)"></span></div>
    <div class="nav-label">المالية</div>
    <div class="ni" data-p="accounting" onclick="goPage(this,'accounting')"><span class="ni-icon">💰</span><span class="ni-label">محاسبة المناديب</span></div>
    <div class="ni" data-p="shop-accounting" onclick="goPage(this,'shop-accounting')"><span class="ni-icon">🏪</span><span class="ni-label">محاسبة المحل</span></div>
    <div class="ni" data-p="checks" onclick="goPage(this,'checks')"><span class="ni-icon">📋</span><span class="ni-label">الشيكات</span><span class="nbadge" id="nb-checks" style="background:var(--danger)"></span></div>
    <div class="ni" data-p="reports" onclick="goPage(this,'reports')"><span class="ni-icon">📊</span><span class="ni-label">التقارير</span></div>
    <div class="nav-label">المخزون</div>
    <div class="ni" data-p="expiry" onclick="goPage(this,'expiry')"><span class="ni-icon">⏳</span><span class="ni-label">تواريخ الصلاحية</span><span class="nbadge" id="nb-expiry" style="background:var(--danger)"></span></div>
    <div class="nav-label">النظام</div>
    <div class="ni" data-p="notifs" onclick="goPage(this,'notifs')"><span class="ni-icon">🔔</span><span class="ni-label">الإشعارات</span><span class="nbadge" id="nb-notifs">0</span></div>
    <div class="ni" data-p="settings" onclick="goPage(this,'settings')"><span class="ni-icon">⚙️</span><span class="ni-label">الإعدادات</span></div>
  </nav>
  <div class="sb-foot"><div class="sb-status"><div class="sdot" id="sdot"></div><span class="sb-status-text" id="stxt">غير متصل</span></div></div>
</aside>

<div class="main-area">
  <div class="topbar">
    <h1 class="topbar-title" id="ptitle">لوحة التحكم</h1>
    <div class="search-wrap"><span class="search-ic">🔍</span><input type="text" placeholder="بحث..." id="srch" oninput="onSearch(this.value)"></div>
    <div class="api-badge wait" id="api-badge">⏳ جاري...</div>
    <button class="btn btn-ghost" onclick="syncNow()">🔄 مزامنة</button>
      <button class="btn btn-ghost" onclick="openM('m-import')" style="color:var(--purple);border-color:var(--purple)">📥 استيراد من Shopify</button>
    <button class="btn btn-primary" onclick="openM('m-order')">＋ طلب جديد</button>
    <div style="display:flex;align-items:center;gap:8px;margin-right:8px;border-right:1px solid var(--border);padding-right:12px">
      <span id="user-badge" style="font-size:12px;color:var(--muted);font-family:Roboto,sans-serif">👤</span>
      <button class="btn btn-ghost btn-sm" onclick="doLogout()" title="تسجيل الخروج" style="color:var(--danger)">خروج ↩</button>
    </div>
  </div>

  <div class="content">

  <!-- DASHBOARD -->
  <div class="page active" id="page-dashboard">
    <div class="banner disc" id="main-banner">
      <div><h4>🔌 Backend غير متصل</h4><p>اضبط رابط الـ API من الإعدادات لتفعيل الربط مع Shopify</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)" onclick="syncNow()">🔄 مزامنة</button>
        <button class="btn btn-sm" style="background:#fff;color:#6366f1;font-weight:700" onclick="goPage(document.querySelector('[data-p=settings]'),'settings')">الإعدادات</button>
      </div>
    </div>
    <div class="stats-row">
      <div class="sc blue"><div class="sc-icon">📦</div><div class="sc-label">إجمالي الطلبات</div><div class="sc-val" id="st-total">0</div></div>
      <div class="sc orange"><div class="sc-icon">⏳</div><div class="sc-label">تحتاج توزيع</div><div class="sc-val" id="st-wait">0</div></div>
      <div class="sc blue"><div class="sc-icon">🚴</div><div class="sc-label">قيد التوصيل</div><div class="sc-val" id="st-go">0</div></div>
      <div class="sc green"><div class="sc-icon">✅</div><div class="sc-label">مكتملة</div><div class="sc-val" id="st-done">0</div></div>
      <div class="sc purple"><div class="sc-icon">💰</div><div class="sc-label">إيرادات اليوم</div><div class="sc-val" id="st-rev">0 ج</div></div>
    </div>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:16px">
      <div class="card"><div class="card-hd"><h3>⚡ أحدث الطلبات</h3><button class="btn btn-ghost btn-sm" onclick="goPage(document.querySelector('[data-p=orders]'),'orders')">الكل</button></div><div class="tw"><table><thead><tr><th>الطلب</th><th>العميل</th><th>المنطقة</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody id="dash-orders"></tbody></table></div></div>
      <div class="card"><div class="card-hd"><h3>🚴 المناديب</h3></div><div class="tw"><table><thead><tr><th>المندوب</th><th>نشط</th><th>مكتمل</th></tr></thead><tbody id="dash-couriers"></tbody></table></div></div>
    </div>
  </div>

  <!-- ORDERS -->
  <div class="page" id="page-orders">
    <div class="card">
      <div class="card-hd">
        <div class="chips" id="order-chips">
          <button class="chip on" onclick="filterSt(this,'all')">الكل</button>
          <button class="chip" onclick="filterSt(this,'جديد')">جديد</button>
          <button class="chip" onclick="filterSt(this,'في الانتظار')">في الانتظار</button>
          <button class="chip" onclick="filterSt(this,'جاري التوصيل')">جاري التوصيل</button>
          <button class="chip" onclick="filterType(this,'pickup')">🏪 استلام من المحل</button>
          <button class="chip" onclick="filterType(this,'express')">⚡ مستعجل</button>
          <button class="chip" onclick="filterSt(this,'مكتمل')">مكتمل</button>
          <button class="chip" onclick="filterSt(this,'ملغي')">ملغي</button>
          <button class="chip" onclick="filterSt(this,'cancelled-unassigned')" title="ملغية وليس لها مندوب">ملغي بدون توزيع</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openM('m-order')">＋</button>
      </div>
      <div class="tw"><table><thead><tr><th>رقم الطلب</th><th>المصدر</th><th>العميل</th><th>الهاتف</th><th>المنطقة</th><th>نوع التوصيل</th><th>COD</th><th>الشحن</th><th>المندوب</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody id="orders-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- COURIERS -->
  <div class="page" id="page-couriers">
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px"><button class="btn btn-primary" onclick="openM('m-courier')">＋ إضافة مندوب</button></div>
    <div class="card"><div class="card-hd"><h3>🚴 فريق التوصيل</h3><span id="courier-count" style="font-size:12px;color:var(--muted)"></span></div><div class="cgrid" id="couriers-grid"></div></div>
  </div>

  <!-- ASSIGN -->
  <div class="page" id="page-assign">
    <div class="card"><div class="card-hd"><h3>📍 الطلبات بدون مندوب</h3><span id="assign-count" style="font-size:12px;color:var(--muted)"></span><button onclick="startBatch()" id="btn-start-batch" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:9px;padding:8px 18px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">🚀 ابدأ دفعة</button>
      <button onclick="resumeBatch()" id="btn-resume-batch" style="display:none;background:#f0fdf4;color:#15803d;border:2px solid #86efac;border-radius:9px;padding:8px 18px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">▶ استكمال الدفعة</button>
      <button onclick="endBatch()" id="btn-end-batch" style="display:none;background:#fef2f2;color:#ef4444;border:2px solid #fca5a5;border-radius:9px;padding:8px 18px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">⏹ إنهاء الدفعة</button></div>
    <div class="tbl-wrap"><table><thead><tr>
  <th style="width:30px"><input type="checkbox" id="assign-check-all" onchange="assignToggleAll(this.checked)"></th>
  <th style="width:75px">الطلب</th>
  <th style="width:70px">النوع</th>
  <th style="width:85px">العميل</th>
  <th style="width:60px">المنطقة</th>
  <th>العنوان</th>
  <th style="width:80px">COD</th>
  <th style="width:280px">التوزيع (مناديب / بوسطة)</th>
</tr></thead><tbody id="assign-tbody"></tbody></table></div></div>
  </div>

  <!-- PICKUP PAGE -->
  <div class="page" id="page-pickup">
    <div class="card">
      <div class="card-hd">
        <h3>🏪 طلبات الاستلام من المحل</h3>
        <span id="pickup-count" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" id="pickup-sel-all" onclick="pickupSelAll()">☐ تحديد الكل</button>
        <button class="btn btn-success btn-sm" onclick="pickupBulkDone()" id="pickup-bulk-done" style="display:none">✅ تسليم المحدد</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);display:none" onclick="pickupBulkCancel()" id="pickup-bulk-cancel">❌ إلغاء المحدد</button>
        <span id="pickup-sel-count" style="font-size:12px;color:var(--muted)"></span>
        <div style="margin-right:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="printPickupSlip('pending')">🖨️ الطلبات المعلقة</button>
          <button class="btn btn-ghost btn-sm" onclick="printPickupSlip('new')">🆕 جديدة منذ آخر طباعة</button>
          <span id="pickup-last-print" style="font-size:10px;color:var(--muted)">لم تتم طباعة بعد</span>
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th style="width:36px"><input type="checkbox" id="pickup-check-all" onchange="pickupToggleAll(this.checked)"></th><th>رقم الطلب</th><th>العميل</th><th>المنتجات</th><th>إجمالي</th><th>الدفع</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody id="pickup-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- TRANSIT PAGE -->
  <!-- MODAL: إضافة مورد -->
  <div class="overlay" id="m-add-supplier">
    <div class="modal" style="width:380px">
      <div class="mhd"><h3>+ إضافة مورد</h3><button class="xbtn" onclick="closeM('m-add-supplier')">✕</button></div>
      <div class="mbody">
        <div class="fg"><label>اسم المورد *</label><input id="supplier-name-input" placeholder="مثال: شركة المواد الغذائية"></div>
        <div class="fg"><label>ملاحظات</label><input id="supplier-note-input" placeholder="اختياري"></div>
      </div>
      <div class="mft">
        <button class="btn btn-ghost" onclick="closeM('m-add-supplier')">إلغاء</button>
        <button class="btn btn-primary" onclick="saveSupplier()">💾 إضافة</button>
      </div>
    </div>
  </div>

  <div class="page" id="page-transit">
    <div class="card">
      <div class="card-hd">
        <h3>🏭 طلبات مخزن العبور</h3>
        <span id="transit-count" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="transitSelAll()">☐ تحديد الكل</button>
        <button class="btn btn-success btn-sm" style="display:none" onclick="transitBulkDone()" id="transit-bulk-done">✅ تسليم المحدد</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);display:none" onclick="transitBulkCancel()" id="transit-bulk-cancel">❌ إلغاء المحدد</button>
        <span id="transit-sel-count" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th style="width:36px"><input type="checkbox" id="transit-check-all" onchange="transitToggleAll(this.checked)"></th><th>رقم الطلب</th><th>المصدر</th><th>العميل</th><th>الهاتف</th><th>المنتجات</th><th>إجمالي</th><th>الدفع</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody id="transit-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- BOSTA PAGE -->
  <div class="page" id="page-bosta">
    <!-- إعداد بوسطة (يظهر لو مش متربط) -->
    <div id="bosta-setup-banner" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:12px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:15px;font-weight:700;margin-bottom:3px">🚚 ربط بوسطة API</div>
        <div style="font-size:12px;opacity:.85">حط الـ API Key بتاع بوسطة عشان ترفع البوليصات تلقائياً</div>
      </div>
      <button class="btn btn-sm" style="background:#fff;color:#6366f1;font-weight:700" onclick="toggleBostaSetup()">⚙️ إعداد الـ API</button>
    </div>

    <!-- فورم الإعداد (مخفي بالأصل) -->
    <div id="bosta-setup-form" style="display:none" class="card">
      <div class="card-hd"><h3>⚙️ إعداد بوسطة API</h3></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fg"><label>Bosta API Key</label><input type="password" id="bosta-api-key" placeholder="أدخل الـ API Key من داشبورد بوسطة"></div>
          <div class="fg"><label>البيئة</label>
            <select id="bosta-env">
              <option value="production">Production (الحقيقي)</option>
              <option value="staging">Staging (تجريبي)</option>
            </select>
          </div>
          <div class="fg"><label>Business Location ID (اختياري)</label><input type="text" id="bosta-location-id" placeholder="ID موقع الاستلام من داشبورد بوسطة"></div>
          <div class="fg"><label>اسم المحل</label><input type="text" id="bosta-business-name" placeholder="مثال: متجر النور"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fg"><label>عنوان المحل (للبوليصة) *</label><input type="text" id="bosta-pickup-address" placeholder="مثال: شارع التحرير، الدقي، الجيزة"></div>
          <div class="fg"><label>مدينة المحل</label><input type="text" id="bosta-pickup-city" placeholder="القاهرة"></div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px">للحصول على الـ API Key: سجل دخول على <a href="https://business.bosta.co" target="_blank" style="color:var(--accent)">business.bosta.co</a> ← الإعدادات ← API</div>
        <button class="btn btn-primary btn-sm" onclick="saveBostaSettings()">💾 حفظ وتجربة الاتصال</button>
        <span id="bosta-conn-status" style="font-size:12px;margin-right:10px"></span>
      </div>
    </div>

    <!-- إحصائيات -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="sc blue"><div class="sc-icon">📦</div><div class="sc-label">طلبات متاحة للرفع</div><div class="sc-val" id="bosta-total">0</div></div>
      <div class="sc orange"><div class="sc-icon">⏳</div><div class="sc-label">لم ترفع بعد</div><div class="sc-val" id="bosta-pending">0</div></div>
      <div class="sc green"><div class="sc-icon">✅</div><div class="sc-label">مرفوعة على بوسطة</div><div class="sc-val" id="bosta-sent">0</div></div>
      <div class="sc purple"><div class="sc-icon">🔄</div><div class="sc-label">قيد التوصيل</div><div class="sc-val" id="bosta-inprogress">0</div></div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>🚚 طلبات المحافظات — بوسطة</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span id="bosta-count" style="font-size:12px;color:var(--muted)"></span>
          <button class="btn btn-ghost btn-sm" onclick="bostaSelAll()">☐ تحديد الكل</button>
          <span id="bosta-sel-info" style="font-size:12px;color:var(--muted)"></span>
          <button class="btn btn-primary btn-sm" id="bosta-bulk-btn" style="display:none" onclick="bostaCreateBulk()">🚀 رفع المحدد على بوسطة</button>
          <button class="btn btn-ghost btn-sm" id="bosta-export-btn" style="display:none;background:#10b981;color:#fff;border-color:#10b981" onclick="exportBostaExcel()">📥 تصدير Excel (تمبلت بوسطة)</button>
        </div>
      </div>
      <!-- شريط الفلترة -->
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--bg)">
        <span style="font-size:12px;color:var(--muted)">عرض:</span>
        <button class="chip on" id="bosta-filter-sent" onclick="bostaSetFilter('sent',this)">✅ مرفوعة على بوسطة</button>
        <button class="chip" id="bosta-filter-pending" onclick="bostaSetFilter('pending',this)">📋 كل الطلبات المتاحة للرفع</button>
      </div>
      <div class="tw">
        <table>
          <thead><tr>
            <th style="width:30px"><input type="checkbox" id="bosta-check-all" onchange="bostaToggleAll(this.checked)"></th>
            <th>رقم الطلب</th>
            <th>العميل</th>
            <th>الهاتف</th>
            <th>المحافظة / المدينة</th>
            <th>العنوان</th>
            <th>COD</th>
            <th>حالة بوسطة</th>
            <th>إجراءات</th>
          </tr></thead>
          <tbody id="bosta-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- COURIER ORDERS PAGE -->
  <div class="page" id="page-courier-orders">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px" id="courier-tabs"></div>
    <div id="courier-orders-content"></div>
  </div>

  <!-- IMPORT EXCEL PAGE -->
  <div class="page" id="page-import-excel">
    <div class="card" style="max-width:600px;margin:0 auto">
      <div class="card-hd"><h3>📥 استيراد طلبات من Excel</h3></div>
      <div class="card-body">
        <div style="margin-bottom:16px;font-size:13px;color:var(--muted);line-height:1.8">
          ارفع ملف Excel المندوب — الاسم يبدأ باسم المندوب (مثال: <strong>احمد منسي.xlsx</strong>)
          <br>الأعمدة المطلوبة: رقم الطلب | الاسم | التليفون | المبلغ | المنطقة | العنوان
        </div>

        <!-- اختيار المندوب -->
        <div class="fg" style="margin-bottom:12px">
          <label>اختر المندوب</label>
          <select id="import-courier-sel" style="font-family:Cairo,sans-serif;width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px">
            <option value="">— اختر المندوب —</option>
          </select>
        </div>

        <!-- رفع الملف -->
        <div style="border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;cursor:pointer;background:var(--bg);margin-bottom:12px" onclick="document.getElementById('excel-file-input').click()">
          <div style="font-size:32px;margin-bottom:8px">📄</div>
          <div style="font-weight:700;margin-bottom:4px">اضغط هنا لاختيار ملف Excel</div>
          <div style="font-size:12px;color:var(--muted)">.xlsx أو .xls</div>
          <input type="file" id="excel-file-input" accept=".xlsx,.xls" style="display:none" onchange="handleExcelFile(this)">
        </div>

        <!-- نتيجة القراءة -->
        <div id="import-preview" style="display:none;background:var(--bg);border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px"></div>

        <!-- زرار الاستيراد -->
        <button id="import-excel-btn" class="btn btn-primary" style="width:100%;display:none" onclick="doExcelImport()">
          ✅ استيراد الطلبات
        </button>
        <div id="import-result" style="margin-top:10px;font-size:13px;font-weight:700;text-align:center"></div>
      </div>
    </div>
  </div>

  <!-- PROBLEMS PAGE -->
  <div class="page" id="page-problems">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px" id="problems-tabs">
      <button class="chip on" id="prob-tab-dup" onclick="probFilter('dup',this)">👥 متكررون</button>
      <button class="chip" id="prob-tab-manual" onclick="probFilter('manual',this)">⚠️ مشاكل يدوية <span id="prob-manual-count"></span></button>
      <button class="chip" id="prob-tab-noaddr" onclick="probFilter('noaddr',this)">📍 بدون عنوان</button>
      <button class="chip" id="prob-tab-nophone" onclick="probFilter('nophone',this)">📵 بدون تليفون</button>
      <button class="chip" id="prob-tab-cancelled" onclick="probFilter('cancelled',this)">❌ ملغية غير مرتبة</button>
    </div>
    <div id="problems-content"></div>
  </div>

  <!-- ACCOUNTING -->
  <!-- CHECKS PAGE -->
  <div class="page" id="page-checks">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="sc blue"><div class="sc-icon">📋</div><div class="sc-label">إجمالي غير مصروف</div><div class="sc-val" id="chk-total-val">0 ج</div></div>
      <div class="sc orange"><div class="sc-icon">📅</div><div class="sc-label">هذا الأسبوع</div><div class="sc-val" id="chk-week-val">0 ج</div></div>
      <div class="sc" style="background:var(--danger-light)"><div class="sc-icon">⚠️</div><div class="sc-label">متأخرة</div><div class="sc-val" style="color:var(--danger)" id="chk-overdue-val">0</div></div>
      <div class="sc green"><div class="sc-icon">✅</div><div class="sc-label">تم صرفها</div><div class="sc-val" id="chk-done-val">0</div></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="card-body" style="padding:10px 14px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div id="chk-status-chips" style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="chip on" onclick="chkSetFilter('all',this)">الكل</button>
            <button class="chip" onclick="chkSetFilter('pending',this)">⏳ لم يُصرف</button>
            <button class="chip" onclick="chkSetFilter('done',this)">✅ تم صرفه</button>
            <button class="chip" onclick="chkSetFilter('overdue',this)">⚠️ متأخر</button>
            <button class="chip" onclick="chkSetFilter('weekly',this)">📅 تقرير أسبوعي</button>
            <button class="chip" onclick="chkSetFilter('suppliers',this)">🏢 تقرير الموردين</button>
          </div>
          <select id="chk-period-filter" onchange="renderChecksPage()" style="font-family:Cairo,sans-serif;padding:5px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px">
            <option value="all">كل الفترات</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="overdue">متأخرة فقط</option>
          </select>
          <input id="chk-search" placeholder="ابحث..." oninput="renderChecksPage()" style="padding:5px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;font-family:Cairo,sans-serif;width:150px">
          <div style="margin-right:auto;display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="openCheckBook()">📚 دفاتر</button>
            <button class="btn btn-primary btn-sm" onclick="openAddChk()">+ شيك جديد</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-hd"><h3>📋 الشيكات</h3><span id="chk-count" style="font-size:12px;color:var(--muted)"></span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>رقم</th><th>لصالح</th><th>القيمة</th><th>الاستحقاق</th><th>الدفتر</th><th>فاتورة</th><th>الحالة</th><th>صورة</th><th>إجراءات</th></tr></thead>
        <tbody id="chk-tbody"></tbody>
      </table></div>
      <div id="chk-sum-row" style="display:none;padding:12px 16px;background:var(--accent-light);font-weight:700;font-size:13px;color:var(--accent);border-top:2px solid var(--accent)"></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-hd"><h3>🔍 مجموع غير مصروف حتى تاريخ</h3></div>
      <div class="card-body" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <label style="font-size:13px;font-weight:600">حتى:</label>
          <input type="date" id="chk-until" onchange="calcChkUntil()" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif">
        </div>
        <div><div id="chk-until-result" style="font-size:24px;font-weight:700;color:var(--accent)">—</div>
        <div id="chk-until-count" style="font-size:12px;color:var(--muted)"></div></div>
      </div>
    </div>
  </div>

  <!-- SHOP ACCOUNTING -->
  <div class="page" id="page-shop-accounting">
    <div class="card" style="margin-bottom:14px">
      <div class="card-body" style="padding:12px 16px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-weight:700;font-size:13px">الفترة:</span>
          <button class="chip on" id="sacc-tab-today" onclick="saccFilter('today',this)">اليوم</button>
          <button class="chip" id="sacc-tab-week" onclick="saccFilter('week',this)">هذا الأسبوع</button>
          <button class="chip" id="sacc-tab-month" onclick="saccFilter('month',this)">هذا الشهر</button>
          <button class="chip" id="sacc-tab-all" onclick="saccFilter('all',this)">الكل</button>
          <button class="btn btn-ghost btn-sm" style="margin-right:auto" onclick="printShopAccounting()">🖨️ طباعة</button>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="sc green"><div class="sc-icon">💰</div><div class="sc-label">إجمالي المبيعات</div><div class="sc-val" id="sacc-total">0 ج</div></div>
      <div class="sc blue"><div class="sc-icon">📦</div><div class="sc-label">طلبات مكتملة</div><div class="sc-val" id="sacc-count">0</div></div>
      <div class="sc orange"><div class="sc-icon">💵</div><div class="sc-label">COD محصّل</div><div class="sc-val" id="sacc-cod">0 ج</div></div>
      <div class="sc purple"><div class="sc-icon">💳</div><div class="sc-label">مدفوع أونلاين</div><div class="sc-val" id="sacc-paid">0 ج</div></div>
    </div>
    <div class="card">
      <div class="card-hd">
        <h3>🏪 طلبات مكتملة — المحل</h3>
        <span id="sacc-subtitle" style="font-size:12px;color:var(--muted)"></span>
        <div style="margin-right:auto;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="printShopAccounting()">🖨️ طباعة</button>
          <button class="btn btn-primary btn-sm" onclick="openShopSettle()">💰 تسوية</button>
        </div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المنطقة</th><th>إجمالي الطلب</th><th>نوع الدفع</th><th>حالة التسوية</th></tr></thead>
        <tbody id="sacc-tbody"></tbody>
        <tfoot id="sacc-tfoot"></tfoot>
      </table></div>
    </div>
  </div>

  <!-- MODAL: شيك جديد/تعديل -->
  <div class="overlay" id="m-chk">
    <div class="modal">
      <div class="mhd"><h3 id="chk-modal-title">شيك جديد</h3><button class="xbtn" onclick="closeM('m-chk')">✕</button></div>
      <div class="mbody">
        <div class="fg">
          <label>الدفتر *</label>
          <select id="chk-book-sel" onchange="onChkBookChange()" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px">
            <option value="">— اختر الدفتر —</option>
          </select>
        </div>
        <div class="fg">
          <label>رقم الشيك *</label>
          <select id="chk-num-sel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px">
            <option value="">— اختر الدفتر أولاً —</option>
          </select>
        </div>
        <div class="fg">
          <label>المورد *</label>
          <div style="display:flex;gap:6px">
            <select id="chk-payee-sel" onchange="onChkPayeeChange()" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px">
              <option value="">— اختر المورد —</option>
            </select>
            <button class="btn btn-ghost btn-sm" onclick="openAddSupplier()" title="إضافة مورد جديد" style="white-space:nowrap">+ مورد</button>
          </div>
          <input id="chk-payee" placeholder="أو اكتب يدوياً..." style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-top:6px;color:var(--muted)">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fg"><label>القيمة *</label><input id="chk-amount" type="number" placeholder="0" step="0.01"></div>
          <div class="fg"><label>تاريخ الاستحقاق *</label><input id="chk-date" type="date"></div>
        </div>
        <div class="fg"><label>رقم الفاتورة</label><input id="chk-invoice" placeholder="اختياري"></div>
        <div class="fg"><label>ملاحظات</label><textarea id="chk-note" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px"></textarea></div>
        <div class="fg">
          <label>صورة الشيك</label>
          <div id="chk-img-preview" onclick="document.getElementById('chk-img-input').click()" style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;cursor:pointer;min-height:80px;display:flex;align-items:center;justify-content:center">
            <span id="chk-img-placeholder" style="color:var(--muted);font-size:13px">اضغط لإضافة صورة</span>
            <img id="chk-img-show" style="display:none;max-width:100%;max-height:200px;border-radius:6px">
          </div>
          <input type="file" id="chk-img-input" accept="image/*" style="display:none" onchange="previewChkImg(this)">
          <button class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:11px" onclick="clearChkImg()">🗑️ إزالة</button>
        </div>
      </div>
      <div class="mft">
        <button class="btn btn-ghost" onclick="closeM('m-chk')">إلغاء</button>
        <button class="btn btn-primary" onclick="saveChk()">💾 حفظ</button>
      </div>
    </div>
  </div>

  <!-- MODAL: دفاتر الشيكات -->
  <div class="overlay" id="m-chk-books">
    <div class="modal">
      <div class="mhd"><h3>📚 دفاتر الشيكات</h3><button class="xbtn" onclick="closeM('m-chk-books')">✕</button></div>
      <div class="mbody">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="fg" style="margin:0"><label>اسم الدفتر *</label><input id="bk-name" placeholder="البنك الأهلي 2024"></div>
          <div class="fg" style="margin:0"><label>البنك</label><input id="bk-bank" placeholder="اسم البنك"></div>
          <div class="fg" style="margin:0"><label>رقم الحساب</label><input id="bk-account"></div>
          <div class="fg" style="margin:0"><label>عدد الأوراق</label><input id="bk-pages" type="number" value="48" min="1"></div>
          <div class="fg" style="margin:0"><label>رقم أول شيك *</label><input id="bk-first-num" type="number" placeholder="مثال: 1001" min="1"></div>
          <div class="fg" style="margin:0"><label>رقم آخر شيك</label><input id="bk-last-num" type="number" placeholder="يُحسب تلقائياً" readonly style="background:var(--bg);color:var(--muted)"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveChkBook()" style="width:100%;margin-bottom:12px">+ إضافة دفتر</button>
        <div id="chk-books-list"></div>
      </div>
      <div class="mft"><button class="btn btn-ghost" onclick="closeM('m-chk-books')">إغلاق</button></div>
    </div>
  </div>

  <!-- MODAL: صورة الشيك -->
  <div class="overlay" id="m-chk-img" onclick="closeM('m-chk-img')">
    <div style="background:#000;border-radius:12px;overflow:hidden;max-width:90vw;max-height:90vh">
      <img id="chk-img-full" style="max-width:90vw;max-height:90vh;display:block">
    </div>
  </div>

  <!-- MODAL: تسوية محاسبة المحل -->
  <div class="overlay" id="m-shop-settle">
    <div class="modal" style="width:600px">
      <div class="mhd"><h3>💰 تسوية محاسبة المحل</h3><button class="xbtn" onclick="closeM('m-shop-settle')">✕</button></div>
      <div class="mbody" id="shop-settle-body">
        <!-- يتحدث عند الفتح -->
      </div>
      <div class="mft">
        <button class="btn btn-ghost" onclick="closeM('m-shop-settle')">إغلاق</button>
        <button class="btn btn-ghost" onclick="printShopSettle()">🖨️ طباعة التسوية</button>
        <button class="btn btn-primary" onclick="doShopSettle()">✅ تأكيد التسوية</button>
      </div>
    </div>
  </div>

  <!-- MODAL: تحويل طلب محل لشحن -->
  <div class="overlay" id="m-convert-delivery">
    <div class="modal">
      <div class="mhd"><h3>🚚 تحويل لشحن</h3><button class="xbtn" onclick="closeM('m-convert-delivery')">✕</button></div>
      <div class="mbody">
        <div id="convert-order-info" style="background:var(--bg);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px"></div>
        <div class="fg">
          <label>تمن الشحن الإضافي</label>
          <input id="convert-ship-cost" type="number" value="80" min="0" style="font-size:20px;font-weight:700;text-align:center;width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif">
          <div style="font-size:12px;color:var(--muted);margin-top:5px">💡 التحصيل = إجمالي الطلب + تمن الشحن</div>
        </div>
        <div class="fg">
          <label>اختر المندوب أو بوسطة</label>
          <div id="convert-couriers-list" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
        </div>
      </div>
      <div class="mft"><button class="btn btn-ghost" onclick="closeM('m-convert-delivery')">إلغاء</button></div>
    </div>
  </div>

  <!-- ACCOUNTING -->
  <div class="page" id="page-accounting">
    <div class="acc-tabs"><div class="acc-tab on" onclick="accTab(this,'acc-sum')">ملخص المناديب</div><div class="acc-tab" onclick="accTab(this,'acc-det')">تفاصيل الطلبات</div><div class="acc-tab" onclick="accTab(this,'acc-set')">تسوية الحسابات</div></div>
    <div class="acc-sec on" id="acc-sum"><div class="card"><div class="card-hd"><h3>💰 ملخص محاسبة المناديب</h3></div><div class="tw"><table><thead><tr><th>المندوب</th><th>مكتملة</th><th>إجمالي COD</th><th>تمن الشحن</th><th>صافي المحل</th><th>مستحق للمندوب</th><th>التسوية</th><th>إجراء</th></tr></thead><tbody id="acc-tbody"></tbody><tfoot><tr class="acc-hl" id="acc-total"></tr></tfoot></table></div></div></div>
    <div class="acc-sec" id="acc-det"><div class="card"><div class="card-hd"><h3>📋 تفاصيل الطلبات</h3><select id="acc-cf" onchange="renderAccDet()" style="font-family:Cairo,sans-serif;font-size:12px;padding:5px 10px;border:1px solid var(--border);border-radius:7px;outline:none"><option value="all">كل المناديب</option></select></div><div class="tw"><table><thead><tr><th>رقم الطلب</th><th>المندوب</th><th>العميل</th><th>المنطقة</th><th>نوع التوصيل</th><th>COD</th><th>الشحن</th><th>صافي المحل</th><th>الحالة</th></tr></thead><tbody id="acc-det-tbody"></tbody></table></div></div></div>
    <div class="acc-sec" id="acc-set"><div class="card"><div class="card-hd"><h3>✅ تسوية الحسابات</h3></div><div class="card-body" id="settle-list"></div></div></div>
  </div>

  <!-- REPORTS -->
  <div class="page" id="page-reports">
    <div class="stats-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="sc green"><div class="sc-icon">💵</div><div class="sc-label">إجمالي الإيرادات</div><div class="sc-val" id="r-rev">0 ج</div></div>
      <div class="sc blue"><div class="sc-icon">📦</div><div class="sc-label">طلبات مكتملة</div><div class="sc-val" id="r-done">0</div></div>
      <div class="sc red"><div class="sc-icon">❌</div><div class="sc-label">طلبات ملغية</div><div class="sc-val" id="r-cancel">0</div></div>
      <div class="sc purple"><div class="sc-icon">📈</div><div class="sc-label">نسبة الإتمام</div><div class="sc-val" id="r-rate">0%</div></div>
    </div>
    <div class="card"><div class="card-hd"><h3>🏆 أداء المناديب</h3></div><div class="tw"><table><thead><tr><th>المندوب</th><th>إجمالي</th><th>مكتملة</th><th>ملغية</th><th>COD محصّل</th><th>تمن الشحن</th><th>صافي المحل</th><th>نسبة نجاح</th></tr></thead><tbody id="report-tbody"></tbody></table></div></div>
  </div>

  <!-- DELIVERY SHEET -->
  <div class="page" id="page-delivery-sheet">
    <div class="ds-wrap">
      <div class="ds-ctrl">
        <select id="ds-courier-sel" style="font-family:Cairo,sans-serif;font-size:12px;padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font-weight:600" onchange="dsRender()"></select>
        <span style="font-size:11px;color:var(--muted);padding:0 4px">طباعة:</span>
        <button class="ds-btn active" id="ds-btn-full" onclick="dsSetMode('full')">📋 مجمع</button>
        <button class="ds-btn exp-btn" id="ds-btn-exp" onclick="dsSetMode('express')">⚡ مستعجل فقط</button>
        <button class="ds-btn zone-btn" id="ds-btn-zone" onclick="dsSetMode('zone')">📍 منطقة محددة</button>
        <button class="ds-btn print-btn" onclick="doPrint()">🖨️ طباعة / PDF</button>
      </div>
      <div class="zone-picker" id="ds-zone-picker">
        <span style="font-size:11px;color:var(--muted);margin-left:8px;white-space:nowrap">اختر منطقة:</span>
        <div id="ds-zone-pills" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
      <div class="ds" id="ds-sheet"></div>
    </div>
  </div>

  <!-- NOTIFS -->
  <div class="page" id="page-notifs">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-ghost btn-sm" onclick="markAllRead()">تحديد الكل كمقروء</button></div>
    <div class="card"><div class="card-hd"><h3>🔔 الإشعارات</h3></div><div id="notifs-list"></div></div>
  </div>

  <!-- SETTINGS -->
  <div class="page" id="page-settings">
    <!-- Setup Card -->
    <div class="card" style="margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:16px 20px;color:#fff"><h3 style="font-size:15px;font-weight:800;margin-bottom:3px">🚀 خطوات ربط Shopify</h3><p style="font-size:12px;opacity:.85">اتبع الخطوات دي بالترتيب</p></div>
      <div class="wstep"><div class="wnum done">✓</div><div class="wbody"><h4>✅ رفع البرنامج على Netlify</h4><p>تم بنجاح</p></div></div>
      <div class="wstep">
        <div class="wnum" id="wn2">2</div>
        <div class="wbody">
          <h4>رفع الـ Backend على Railway</h4>
          <p>اضغط الزرار هنا وحمّل الملفين، بعدين ارفعهم على railway.app</p>
          <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="downloadBackend()">⬇️ تحميل ملفات الـ Backend (server.js + package.json)</button>
          <div class="wnote" style="margin-top:8px">بعد ما ترفعهم على Railway هيديك رابط — انسخه وحطه في الخطوة الجاية</div>
        </div>
      </div>
      <div class="wstep">
        <div class="wnum" id="wn3">3</div>
        <div class="wbody">
          <h4>حط رابط الـ Backend هنا</h4>
          <div class="fg" style="margin-top:8px"><input type="text" id="cfg-api" placeholder="https://orderpro-xxx.railway.app" oninput="onApiInput()"></div>
          <button class="btn btn-primary btn-sm" onclick="testBackend()">🔗 اختبار الاتصال</button>
        </div>
      </div>
      <div class="wstep">
        <div class="wnum" id="wn4">4</div>
        <div class="wbody">
          <h4>إعداد Shopify Webhook</h4>
          <p>Shopify Admin ← Settings ← Notifications ← Webhooks ← Create webhook</p>
          <p style="margin-top:6px">اختار Event: <strong>Order creation</strong> · Format: <strong>JSON</strong></p>
          <p style="margin-top:4px">URL (اضغط لنسخه):</p>
          <div class="wcode" id="webhook-display" onclick="copyWebhook()">أدخل رابط الـ Backend في الخطوة 3 أولاً</div>
        </div>
      </div>
    </div>

    <div class="sg">
      <div>
        <div class="card"><div class="card-hd"><h3>⚙️ إعدادات</h3></div><div class="card-body">
          <div class="fg"><label>رابط الـ Backend</label><input type="text" id="cfg-api2" placeholder="https://orderpro-xxx.railway.app" oninput="syncApi()"></div>
          <div class="fg"><label>سعر الشحن الافتراضي (جنيه)</label><input type="number" id="cfg-ship" value="50" min="0"></div>
          <button class="btn btn-success btn-sm" onclick="saveSettings()">💾 حفظ الإعدادات</button>
        </div></div>
        <div class="card"><div class="card-hd"><h3>🔔 الإشعارات</h3></div><div class="card-body">
          <div class="srow"><div class="sinfo"><h4>طلب جديد من Shopify</h4><p>تنبيه فوري</p></div><div class="toggle on" onclick="this.classList.toggle('on')"></div></div>
          <div class="srow"><div class="sinfo"><h4>تذكير التوزيع</h4><p>طلب بدون مندوب أكثر من 30 دقيقة</p></div><div class="toggle on" onclick="this.classList.toggle('on')"></div></div>
          <div class="srow"><div class="sinfo"><h4>إتمام التوصيل</h4><p>تأكيد إنهاء المندوب</p></div><div class="toggle" onclick="this.classList.toggle('on')"></div></div>
        </div></div>
      </div>
      <div>
        <div class="card"><div class="card-hd"><h3>👥 إدارة الفريق</h3></div><div class="card-body">
          <div class="fg"><label>البريد الإلكتروني</label><input type="email" id="u-email" placeholder="user@example.com"></div>
          <div class="fg"><label>الصلاحية</label><select id="u-role"><option value="admin">مشرف كامل</option><option value="staff">موظف</option><option value="courier-mgr">مدير مناديب</option><option value="view">عرض فقط</option></select></div>
          <button class="btn btn-primary btn-sm" onclick="inviteUser()">📨 إرسال دعوة</button>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:10px">المستخدمون</div><div id="users-list"></div></div>
        </div></div>
      </div>
    </div>
  </div>

  </div>
</div>
</div>

<!-- MODALS -->
<div class="overlay" id="m-import"><div class="modal">
  <div class="mhd"><h3>📥 استيراد طلبات من Shopify</h3><button class="xbtn" onclick="closeM('m-import')">✕</button></div>
  <div class="mbd">
    <div style="background:var(--accent-light);border:1px solid #a5b4fc;border-radius:9px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#3730a3;line-height:1.8">
      💡 هيجيب كل طلبات Shopify من آخر عدد الأيام اللي تحدده — الطلبات الجديدة بتتضاف، والطلبات الموجودة بتتحدث تلقائياً
    </div>
    <div class="fg"><label>رابط المتجر</label><input type="text" id="imp-url" placeholder="your-store.myshopify.com"></div>
    <div class="fg"><label>Admin API Access Token</label><input type="password" id="imp-token" placeholder="shpat_xxxxxxxxxxxx"></div>
    <div class="fg">
      <label>استيراد طلبات آخر كم يوم؟</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px" id="days-btns">
        <button class="chip" onclick="selDays(this,1)">يوم 1</button>
        <button class="chip on" onclick="selDays(this,2)">2 أيام</button>
        <button class="chip" onclick="selDays(this,7)">7 أيام</button>
        <button class="chip" onclick="selDays(this,15)">15 يوم</button>
        <button class="chip" onclick="selDays(this,30)">30 يوم</button>
      </div>
      <input type="hidden" id="imp-days" value="2">
    </div>
    <div id="imp-progress" style="display:none;margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:5px">
        <span id="imp-progress-text">جاري الاستيراد...</span>
        <span id="imp-progress-pct">0%</span>
      </div>
      <div style="background:var(--border);border-radius:10px;height:8px;overflow:hidden">
        <div id="imp-progress-bar" style="height:100%;background:var(--accent);border-radius:10px;width:0%;transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:5px;text-align:center" id="imp-fetched">0 طلب حتى الآن...</div>
    </div>
    <div id="imp-result" style="display:none;background:var(--success-light);border:1px solid #86efac;border-radius:8px;padding:12px;font-size:12px;color:#065f46;margin-top:8px"></div>
    <div id="imp-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:8px;padding:12px;font-size:12px;color:#7f1d1d;margin-top:8px"></div>
  </div>
  <div class="mft">
    <button class="btn btn-ghost" onclick="closeM('m-import')">إلغاء</button>
    <button class="btn btn-primary" id="imp-btn" onclick="doImport()">📥 استيراد الآن</button>
  </div>
</div></div>

<div class="overlay" id="m-order"><div class="modal">
  <div class="mhd"><h3>📦 إضافة طلب جديد</h3><button class="xbtn" onclick="closeM('m-order')">✕</button></div>
  <div class="mbd">
    <div class="row2"><div class="fg"><label>اسم العميل *</label><input type="text" id="o-name" placeholder="محمد أحمد"></div><div class="fg"><label>رقم الهاتف</label><input type="text" id="o-phone" placeholder="01xxxxxxxxx"></div></div>
    <div class="fg"><label>العنوان / المنطقة *</label><input type="text" id="o-area" placeholder="القاهرة، المعادي..."></div>
    <div class="fg"><label>تفاصيل الطلب</label><textarea id="o-details" placeholder="المنتجات..."></textarea></div>
    <div class="row2"><div class="fg"><label>إجمالي COD (جنيه) *</label><input type="number" id="o-total" placeholder="0" min="0"></div><div class="fg"><label>تمن الشحن (جنيه)</label><input type="number" id="o-ship" value="50" min="0"></div></div>
    <div class="fg"><label>تعيين مندوب (اختياري)</label><select id="o-courier"><option value="">— بدون تعيين الآن —</option></select></div>
  </div>
  <div class="mft"><button class="btn btn-ghost" onclick="closeM('m-order')">إلغاء</button><button class="btn btn-primary" onclick="addOrder()">✅ إضافة الطلب</button></div>
</div></div>

<div class="overlay" id="m-courier"><div class="modal">
  <div class="mhd"><h3>🚴 إضافة مندوب جديد</h3><button class="xbtn" onclick="closeM('m-courier')">✕</button></div>
  <div class="mbd">
    <div class="row2"><div class="fg"><label>اسم المندوب *</label><input type="text" id="c-name" placeholder="أحمد محمود"></div><div class="fg"><label>رقم الهاتف *</label><input type="text" id="c-phone" placeholder="01xxxxxxxxx"></div></div>
    <div class="fg"><label>المنطقة المسؤول عنها</label><input type="text" id="c-zone" placeholder="المعادي، حلوان..."></div>
    <div class="fg"><label>وسيلة التنقل</label><select id="c-vehicle"><option>دراجة بخارية</option><option>سيارة</option><option>دراجة هوائية</option><option>مشي</option></select></div>
    <div class="row2">
      <div class="fg"><label>💰 تكلفة التوصيل العادي (جنيه)</label><input type="number" id="c-ship" value="50" min="0" placeholder="50"></div>
      <div class="fg"><label>⚡ تكلفة Same Day Delivery (جنيه)</label><input type="number" id="c-ship-express" value="80" min="0" placeholder="80"></div>
    </div>
  </div>
  <div class="mft"><button class="btn btn-ghost" onclick="closeM('m-courier')">إلغاء</button><button class="btn btn-primary" onclick="addCourier()">✅ إضافة المندوب</button></div>
</div></div>

<div class="overlay" id="m-assign"><div class="modal">
  <div class="mhd"><h3 id="assign-title">تعيين مندوب</h3><button class="xbtn" onclick="closeM('m-assign')">✕</button></div>
  <div class="mbd">
    <div id="assign-info" style="background:var(--bg);border-radius:9px;padding:12px;margin-bottom:14px;font-size:12px;line-height:1.8"></div>
    <div class="fg"><label>اختر المندوب</label><div class="cgrid" id="assign-cgrid" style="padding:0;grid-template-columns:repeat(2,1fr)"></div></div>
    <div class="row2" style="margin-top:12px"><div class="fg"><label>تمن الشحن</label><input type="number" id="assign-ship" value="50" min="0"></div><div class="fg"><label>ملاحظات</label><input type="text" id="assign-note" placeholder="تعليمات..."></div></div>
  </div>
  <div class="mft"><button class="btn btn-ghost" onclick="closeM('m-assign')">إلغاء</button><button class="btn btn-success" onclick="confirmAssign()">✅ تعيين المندوب</button></div>
</div></div>

<div class="overlay" id="m-edit-courier"><div class="modal">
  <div class="mhd"><h3 id="edit-courier-title">تعديل بيانات المندوب</h3><button class="xbtn" onclick="closeM('m-edit-courier')">✕</button></div>
  <div class="mbd">
    <div class="row2">
      <div class="fg"><label>اسم المندوب *</label><input type="text" id="ec-name" placeholder="أحمد محمود"></div>
      <div class="fg"><label>رقم الهاتف *</label><input type="text" id="ec-phone" placeholder="01xxxxxxxxx"></div>
    </div>
    <div class="fg"><label>المنطقة المسؤول عنها</label><input type="text" id="ec-zone" placeholder="المعادي، حلوان..."></div>
    <div class="fg"><label>وسيلة التنقل</label>
      <select id="ec-vehicle"><option>دراجة بخارية</option><option>سيارة</option><option>دراجة هوائية</option><option>مشي</option></select>
    </div>
    <div class="row2">
      <div class="fg"><label>💰 تكلفة التوصيل العادي (جنيه)</label><input type="number" id="ec-ship" min="0" placeholder="50"></div>
      <div class="fg"><label>⚡ تكلفة Same Day Delivery (جنيه)</label><input type="number" id="ec-ship-express" min="0" placeholder="80"></div>
    </div>
  </div>
  <div class="mft">
    <button class="btn btn-ghost" onclick="closeM('m-edit-courier')">إلغاء</button>
    <button class="btn btn-danger btn-sm" onclick="delCourierFromEdit()">🗑 حذف</button>
    <button class="btn btn-primary" onclick="saveEditCourier()">💾 حفظ التعديلات</button>
  </div>
</div></div>

<div class="overlay" id="m-settle"><div class="modal">
  <div class="mhd"><h3 id="settle-title">تسوية حساب</h3><button class="xbtn" onclick="closeM('m-settle')">✕</button></div>
  <div class="mbd" id="settle-body"></div>
  <div class="mft"><button class="btn btn-ghost" onclick="closeM('m-settle')">إلغاء</button><button class="btn btn-success" onclick="doSettle()">✅ تأكيد التسوية</button></div>
</div></div>

<div class="toast" id="toast"></div>

<script>
const COLORS=['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316','#84cc16'];
const ROLE_L={admin:'مشرف',staff:'موظف','courier-mgr':'مدير مناديب',view:'عرض فقط'};
const PAGE_T={'courier-orders':'طلبات المناديب','import-excel':'استيراد Excel','problems':'طلبات فيها مشكلة',dashboard:'لوحة التحكم',orders:'الطلبات',couriers:'المناديب',assign:'توزيع الطلبات',pickup:'استلام من المحل',transit:'مخزن العبور',bosta:'بوسطة — طلبات المحافظات',accounting:'محاسبة المناديب',reports:'التقارير','delivery-sheet':'ورقة التوصيل',notifs:'الإشعارات',settings:'الإعدادات',expiry:'تواريخ الصلاحية'};

let API_URL=localStorage.getItem('orderpro_api')||'https://orderpro-backend-production.up.railway.app';
let currentPage='dashboard',assignOrderId=null,selectedCourierId=null,settlingCourierId=null;
let orderFilter='all',searchQ='',defaultShip=50;
let pollingInterval=null,prevOrderCount=0;
let orders=[],notifications=[],nextLocalId=2000;
let couriers=JSON.parse(localStorage.getItem('op_couriers')||'[]');
// ===== إصلاح deliveryType للطلبات القديمة في localStorage =====
orders=orders.map(o=>{
  if(!o.deliveryType||o.deliveryType==='normal'){
    const sm=(o.shippingMethod||'').toLowerCase();
    if(sm.includes('same day')||sm.includes('sameday')) o.deliveryType='express';
    else if(sm.includes('trivium')||sm.includes('pick up')||sm.includes('pickup')) o.deliveryType='pickup';
    else if(sm.includes('transit')) o.deliveryType='transit';
  }
  return o;
});
if(!couriers.length)couriers=[{id:1,name:'أحمد سامي',phone:'01001112222',zone:'الزمالك',vehicle:'دراجة بخارية',ship:60,shipExpress:90,status:'متاح',settled:false},{id:2,name:'محمد كريم',phone:'01112223333',zone:'المهندسين',vehicle:'سيارة',ship:70,shipExpress:110,status:'متاح',settled:false}];
let users=[{email:'admin@store.com',role:'admin',name:'المدير'}];

const $=id=>document.getElementById(id);
const cName=id=>{if(!id)return'<span style="color:var(--muted)">—</span>';const c=couriers.find(x=>x.id==id);return c?c.name:'—'};
const oByC=(cId,st=null)=>orders.filter(o=>o.courierId==cId&&(st?o.status===st:true));
const isSameDay=o=>{
  const dt=(o.deliveryType||'').toLowerCase();
  if(dt==='express') return true;
  const m=(o.shippingMethod||'').toLowerCase();
  return m.includes('same day')||m.includes('sameday');
};
const isPickup=o=>{
  const m=(o.shippingMethod||'').toLowerCase();
  const dt=(o.deliveryType||'').toLowerCase();
  if(dt==='pickup') return true;
  if(m.includes('trivium')) return true;
  if(m.includes('pick up from')||m.includes('pickup from')) return true;
  if((m.includes('pick up')||m.includes('pickup'))&&!m.includes('transit')) return true;
  return false;
};
const isTransit=o=>{
  if(isPickup(o)) return false;
  const dt=(o.deliveryType||'').toLowerCase();
  if(dt==='transit') return true;
  const m=(o.shippingMethod||'').toLowerCase();
  return m.includes('transit warehouse')||m.includes('مخزن العبور')||
         m.includes('transit store')||
         (m.includes('transit')&&!m.includes('trivium'));
};
function deliveryType(o){
  if(isPickup(o)) return 'pickup';
  if(isTransit(o)) return 'transit';
  if(isSameDay(o)) return 'express';
  return 'normal';
}
function deliveryBadge(o){
  const t=deliveryType(o);
  if(t==='pickup')  return '<span class="badge" style="background:#ede9fe;color:#5b21b6;white-space:nowrap;font-size:10px">🏪 استلام</span>';
  if(t==='transit') return '<span class="badge" style="background:#fef3c7;color:#92400e;white-space:nowrap;font-size:10px">🏭 عبور</span>';
  if(t==='express') return '<span class="badge" style="background:#fee2e2;color:#991b1b;white-space:nowrap;font-size:10px">⚡ مستعجل</span>';
  return '<span class="badge" style="background:#dbeafe;color:#1e40af;white-space:nowrap;font-size:10px">🚚 عادي</span>';
}

// اقتراح المندوب الأنسب حسب المنطقة
// ===== نظام اقتراح ذكي مبني على المناطق فقط =====

// تقسيم نص المنطقة لكلمات قابلة للمقارنة
function parseZones(zoneStr){
  return (zoneStr||'').toLowerCase()
    .replace(/[،,\/\-–]/g,' ')
    .split(/\s+/)
    .filter(z=>z.length>=2);
}

// استخراج المنطقة المختصرة من العنوان بناءً على مناطق المناديب
function shortArea(orderArea){
  if(!orderArea) return '—';
  const area = orderArea.toLowerCase().trim();
  // جرب كل مناطق المناديب وشوف مين أقصر كلمة تتطابق
  let best = '';
  for(const c of couriers){
    const zones = parseZones(c.zone);
    for(const z of zones){
      if(z.length >= 2 && (area.includes(z) || z.includes(area))){
        // خد أطول match لأنه أدق
        if(z.length > best.length) best = z;
      }
    }
  }
  if(best) return best;
  // لو مفيش match، خد أول كلمتين من العنوان
  const words = orderArea.trim().split(/[,،\s\-]+/).filter(w=>w.length>=2);
  return words.slice(0,2).join(' ');
}

// حساب درجة تطابق منطقة الطلب مع مناطق المندوب
function getOrderZoneForCourier(o, c){
  // يرجع منطقة من مناطق المندوب فقط — أو "أخري"
  const orderArea=(o.area||'').trim().toLowerCase();
  if(!c||!c.zone) return 'أخري';
  const courierZones=(c.zone||'').split(/[،,\/\-–\n]+/).map(z=>z.trim()).filter(z=>z.length>1);
  if(!courierZones.length) return 'أخري';

  // تطابق تام
  for(const z of courierZones){
    if(orderArea===z.toLowerCase()) return z;
  }
  // تطابق جزئي: المنطقة تحتوي على اسم المنطقة في المندوب
  for(const z of courierZones){
    if(orderArea.includes(z.toLowerCase())||z.toLowerCase().includes(orderArea)) return z;
  }
  // تطابق بالكلمات
  const aWords=orderArea.split(/\s+/).filter(w=>w.length>2);
  for(const z of courierZones){
    const zWords=z.toLowerCase().split(/\s+/).filter(w=>w.length>2);
    if(zWords.some(w=>aWords.some(aw=>aw.includes(w)||w.includes(aw)))) return z;
  }
  // مش لاقي تطابق → أخري
  return 'أخري';
}

function zoneMatchScore(orderArea, courierZone){
  const area = (orderArea||'').toLowerCase().trim();
  const courierZones = parseZones(courierZone);
  
  if(!area||!courierZones.length) return {score:0,reason:'',matched:''};
  
  // 1. تطابق تام — المنطقة موجودة كلمة كاملة في مناطق المندوب
  for(const z of courierZones){
    if(area===z) return {score:100,reason:'تطابق تام',matched:z};
  }
  
  // 2. منطقة الطلب تحتوي على اسم منطقة المندوب
  for(const z of courierZones){
    if(z.length>=3 && area.includes(z)) return {score:80,reason:'منطقة المندوب في العنوان',matched:z};
  }
  
  // 3. اسم منطقة المندوب يحتوي على منطقة الطلب
  for(const z of courierZones){
    if(z.length>=3 && z.includes(area)) return {score:70,reason:'العنوان ضمن منطقة المندوب',matched:z};
  }
  
  // 4. تطابق جزئي — أول 3-4 حروف متشابهة (مفيد للأسماء المختلطة)
  const areaStart = area.substring(0,4);
  for(const z of courierZones){
    if(z.length>=4 && z.startsWith(areaStart)) return {score:50,reason:'تشابه في الاسم',matched:z};
  }
  
  // مفيش تطابق
  return {score:0,reason:'',matched:''};
}

function suggestCourier(order){
  if(!order||!couriers.length) return null;
  if(isPickup(order)||isTransit(order)) return null;

  const area = order.area||'';
  
  const scored = couriers.map(c=>{
    const {score, reason, matched} = zoneMatchScore(area, c.zone);
    const active = oByC(c.id,'جاري التوصيل').length;
    const done   = oByC(c.id,'مكتمل').length;
    return {...c, zoneScore:score, matchReason:reason, matchedZone:matched, active, done};
  });

  // رتّب حسب: درجة المنطقة أولاً، بعدين أقل ضغط
  scored.sort((a,b)=>{
    if(b.zoneScore !== a.zoneScore) return b.zoneScore - a.zoneScore;
    return a.active - b.active; // بين المتساوين نفضل الأقل ضغطاً
  });

  const best = scored[0];
  
  // لا نقترح إلا لو في تطابق منطقة فعلي
  if(!best || best.zoneScore === 0) return null;
  
  return best;
}
const getShipCost=(order,courier)=>{
  if(!courier)return order.ship||50;
  if(isPickup(order)||isTransit(order)) return 0;
  if(isSameDay(order)) return+(courier.shipExpress||courier.ship||80);
  return+(courier.ship||50);
};
const nowTime=()=>new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});

function sBadge(s){const m={جديد:'b-new','في الانتظار':'b-wait','جاري التوصيل':'b-go',مكتمل:'b-done',ملغي:'b-cancel'};return`<span class="badge ${m[s]||'b-wait'}">${s}</span>`}
function paidBadge(o){return o.paid?'<span class="badge" style="background:#dcfce7;color:#166534;margin-right:4px">💳 مدفوع</span>':'<span class="badge" style="background:#fef9c3;color:#854d0e;margin-right:4px">💵 COD</span>'}
function srcBadge(s){return s==='shopify'?'<span class="badge b-shopify">🛍 Shopify</span>':'<span class="badge b-manual">✍️ يدوي</span>'}
function toast(msg){const t=$('toast');t.innerHTML=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
function openM(id){refreshSelects();if(id==='m-assign')renderAssignGrid();$(id).classList.add('open')}
function closeM(id){$(id).classList.remove('open');selectedCourierId=null}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}));

// ===== API =====
async function apiFetch(path,method='GET',body=null){
  const baseUrl = API_URL || BACKEND_URL;
  if(!baseUrl)return null;
  try{
    const opts={method,headers:{'Content-Type':'application/json'},mode:'cors'};
    if(body)opts.body=JSON.stringify(body);
    const r=await fetch(baseUrl.replace(/\/$/,'')+path,opts);
    if(!r.ok)throw new Error(r.status);
    return await r.json();
  }catch(e){console.warn('API:',e);return null}
}

async function syncCouriersToDB(){
  // رفع المناديب المحفوظة في localStorage للـ DB
  if(!API_URL||!couriers.length) return;
  try{
    const existing = await apiFetch('/api/couriers');
    if(existing&&existing.couriers&&existing.couriers.length>0){
      // المناديب موجودة في DB خليهم
      couriers = existing.couriers;
      saveCouriers();
      return;
    }
    // DB فارغة - ارفع المناديب من localStorage
    console.log('Uploading couriers to DB...');
    for(const c of couriers){
      await apiFetch('/api/couriers','POST',{
        name:c.name, phone:c.phone, zone:c.zone||'غير محدد',
        vehicle:c.vehicle||'دراجة بخارية',
        ship:c.ship||50, shipExpress:c.shipExpress||80,
        status:c.status||'متاح', settled:c.settled||false,
      });
    }
    // جيب المناديب من DB عشان تاخد الـ IDs الجديدة
    const updated = await apiFetch('/api/couriers');
    if(updated&&updated.couriers){
      couriers = updated.couriers;
      saveCouriers();
      toast('✅ تم رفع '+couriers.length+' مندوب للـ Database');
    }
  }catch(e){ console.error('syncCouriersToDB error:', e); }
}

async function loadOrders(){
  // أول حاجة: تزامن المناديب مع DB
  await syncCouriersToDB();

  const data=await apiFetch('/api/orders');
  if(!data)return;
  const prev=orders.length;
  // restore isBosta from localStorage if server doesn't have it
let _bostaIds={};
try{_bostaIds=JSON.parse(localStorage.getItem('bosta_ids')||'{}');}catch(e){}

orders=data.orders.map(o=>{
    const base={ship:50,...o};
    // لو الـ server ما رجعش isBosta، جيبها من localStorage
    if(!base.isBosta && _bostaIds[base.id]) base.isBosta=true;
    if(base.isBosta) base.courierId='bosta';
    // لو deliveryType مش موجود، احسبه من shippingMethod
    if(!base.deliveryType||base.deliveryType==='normal'){
      const sm=(base.shippingMethod||'').toLowerCase();
      if(sm.includes('same day')||sm.includes('sameday')) base.deliveryType='express';
      else if(sm.includes('trivium')||sm.includes('pick up')||sm.includes('pickup')) base.deliveryType='pickup';
      else if(sm.includes('transit')) base.deliveryType='transit';
    }
    return base;
  });
  if(orders.length>prev&&prev>0){
    const newO=orders[0];
    pushNotif('📦','طلب جديد من Shopify!',`${newO.id} — ${newO.name} — ${newO.total} ج`);
    toast('🛍 طلب جديد: '+newO.name+' ('+newO.total+' ج)');
  }
  // جلب المناديب من DB
  try{
    const rc=await apiFetch('/api/couriers');
    if(rc&&rc.couriers&&rc.couriers.length>0){couriers=rc.couriers;saveCouriers();}
  }catch(e){}
  // جلب الإشعارات من DB
  try{
    const rn=await apiFetch('/api/notifications');
    if(rn&&rn.notifications){
      notifications=rn.notifications.map(n=>({
        id:n.id,icon:n.icon,title:n.title,sub:n.sub,
        read:n.read,time:new Date(n.created_at||Date.now()).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})
      }));
    }
  }catch(e){}
  refreshAll();
}

async function testBackend(){
  const url=($('cfg-api').value||$('cfg-api2').value).trim();
  if(!url){toast('❗ أدخل رابط الـ Backend');return}
  toast('🔄 جاري اختبار الاتصال...');
  try{
    const r=await fetch(url.replace(/\/$/,'/')+'/');
    if(!r.ok)throw new Error();
    const d=await r.json();
    API_URL=url.replace(/\/$/, '');
    localStorage.setItem('orderpro_api',API_URL);
    $('cfg-api').value=API_URL;$('cfg-api2').value=API_URL;
    updateWebhook();setConnected(true);
    await // loadOrders يُستدعى من doLogin
  startPolling();
    $('wn2').className='wnum done';$('wn2').textContent='✓';
    $('wn3').className='wnum done';$('wn3').textContent='✓';
    $('wn4').className='wnum done';$('wn4').textContent='✓';
    const dbOk=d.db&&d.db.includes('✅');
    const statusTxt='✅ Backend متصل'+(dbOk?' + 🗄️ DB':'')+'  — '+d.orders+' طلب';
    toast(statusTxt);
    // تحديث status bar
    const stxt=$('stxt');
    if(stxt)stxt.textContent=dbOk?'متصل + DB':'متصل';
  }catch{setConnected(false);toast('❌ فشل الاتصال — تأكد من الرابط وإن الـ Backend شغال')}
}

function setConnected(ok){
  $('sdot').className='sdot'+(ok?' on':'');
  $('stxt').textContent=ok?'متصل بـ Backend':'غير متصل';
  const b=$('api-badge');
  b.className='api-badge '+(ok?'ok':'fail');
  b.textContent=ok?'✅ متصل':'❌ غير متصل';
  const bn=$('main-banner');
  if(ok){bn.className='banner conn';bn.innerHTML='<div><h4>✅ Backend + Shopify متصلين</h4><p>الطلبات بتتحدث تلقائياً كل 30 ثانية</p></div><div><button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)" onclick="syncNow()">🔄 مزامنة الآن</button></div>'}
  else{bn.className='banner disc';bn.innerHTML='<div><h4>🔌 Backend غير متصل</h4><p>اضبط رابط الـ API من الإعدادات</p></div><div><button class="btn btn-sm" style="background:#fff;color:#6366f1;font-weight:700" onclick="goPage(document.querySelector(\'[data-p=settings]\'),\'settings\')">الإعدادات</button></div>'}
}

function startPolling(){
  if(pollingInterval)clearInterval(pollingInterval);
  pollingInterval=setInterval(loadOrders,30000);
}

async function syncNow(){
  if(API_URL){toast('🔄 جاري المزامنة...');await loadOrders();toast('✅ تم التحديث')}
  else{
    const names=['طارق مصطفى','ياسمين رضا','سامي الجوهري','منى فرج'];
    const areas=['الشروق','الرحاب','التجمع','مدينة نصر'];
    const id='SH-'+Math.floor(2000+Math.random()*8000);
    const name=names[Math.floor(Math.random()*names.length)];
    const total=Math.floor(400+Math.random()*1800);
    orders.unshift({id,src:'shopify',name,phone:'0100-xxx-xxxx',area:areas[Math.floor(Math.random()*areas.length)],total,ship:defaultShip,courierId:null,status:'جديد',time:nowTime(),note:''});
    pushNotif('📦','[تجريبي] طلب جديد',`${id} — ${name} — ${total} ج`);
    refreshAll();toast('✅ (وضع تجريبي) طلب جديد أُضيف');
  }
}

function onApiInput(){const v=$('cfg-api').value.trim();$('cfg-api2').value=v;if(v){localStorage.setItem('orderpro_api',v);API_URL=v;}updateWebhook()}
function syncApi(){const v=$('cfg-api2').value.trim();$('cfg-api').value=v;if(v){localStorage.setItem('orderpro_api',v);API_URL=v;}updateWebhook()}
function updateWebhook(){const u=API_URL;$('webhook-display').textContent=u?u+'/webhook/shopify':'أدخل رابط الـ Backend في الخطوة 3 أولاً'}
function copyWebhook(){if(!API_URL){toast('❗ أدخل الرابط أولاً');return}navigator.clipboard.writeText(API_URL+'/webhook/shopify');toast('📋 تم نسخ الـ Webhook URL — الصقه في Shopify')}

// ===== STATS =====
function updateStats(){
  const total=orders.length,wait=orders.filter(o=>!o.courierId&&o.status!=='مكتمل'&&o.status!=='ملغي').length;
  const go=orders.filter(o=>o.status==='جاري التوصيل').length,done=orders.filter(o=>o.status==='مكتمل').length;
  const rev=orders.filter(o=>o.status==='مكتمل').reduce((a,o)=>a+o.total,0);
  const cancel=orders.filter(o=>o.status==='ملغي').length;
  $('st-total').textContent=total;$('st-wait').textContent=wait;$('st-go').textContent=go;$('st-done').textContent=done;
  $('st-rev').textContent=rev.toLocaleString()+' ج';
  $('nb-orders').textContent=orders.filter(o=>o.status==='جديد').length;
  $('nb-assign').textContent=wait;
  $('nb-notifs').textContent=notifications.filter(n=>!n.read).length||'';
  const pickupCount=orders.filter(o=>isPickup(o)&&o.status!=='مكتمل'&&o.status!=='ملغي').length;
  const transitCount=orders.filter(o=>isTransit(o)&&o.status!=='مكتمل'&&o.status!=='ملغي').length;
  const bostaCount=orders.filter(o=>o.bostaId).length;
  $('nb-pickup').textContent=pickupCount||'';
  $('nb-transit').textContent=transitCount||'';
  if($('nb-bosta'))$('nb-bosta').textContent=bostaCount||'';
  // badge مشاكل
  const unassignedO=orders.filter(o=>!o.courierId&&o.status!=='ملغي'&&o.status!=='مكتمل');
  const allPhones=unassignedO.map(o=>o.phone).filter(p=>p&&p!=='—');
  const dupPh=allPhones.filter((p,i)=>allPhones.indexOf(p)!==i);
  if($('nb-problems'))$('nb-problems').textContent=new Set(dupPh).size||'';
  $('r-rev').textContent=rev.toLocaleString()+' ج';$('r-done').textContent=done;$('r-cancel').textContent=cancel;
  $('r-rate').textContent=total?Math.round(done/total*100)+'%':'0%';
}

// ===== RENDER =====
function renderDash(){
  $('dash-orders').innerHTML=orders.slice(0,6).map(o=>`<tr><td><strong>${o.id}</strong></td><td>${o.name}</td><td>📍 ${o.area}</td><td><strong>${o.total.toLocaleString()} ج</strong></td><td>${sBadge(o.status)}</td></tr>`).join('');
  $('dash-couriers').innerHTML=couriers.map(c=>`<tr><td><strong>${c.name}</strong></td><td><span class="badge b-go">${oByC(c.id,'جاري التوصيل').length}</span></td><td><span class="badge b-done">${oByC(c.id,'مكتمل').length}</span></td></tr>`).join('');
}

function renderOrders(){
  let list=orders;
  if(orderFilter!=='all')list=list.filter(o=>o.status===orderFilter);
  // إخفاء الطلبات الملغية غير الموزعة بشكل افتراضي
  if(orderFilter==='all')list=list.filter(o=>!(o.status==='ملغي'&&!o.courierId));
  if(orderFilter==='cancelled-unassigned')list=orders.filter(o=>o.status==='ملغي'&&!o.courierId);
  if(orderTypeFilter)list=list.filter(o=>deliveryType(o)===orderTypeFilter);
  // طلبات الاستلام والعبور مش بتظهر في التوزيع
  
  if(searchQ)list=list.filter(o=>(o.id+o.name+o.area+o.phone).includes(searchQ));
  $('orders-tbody').innerHTML=list.map(o=>`<tr><td style="text-align:center"><input type="checkbox" class="ord-chk" value="${o.id}" onchange="updateOrdersBulk()"></td><td><strong>${o.id}</strong></td><td>${srcBadge(o.src)}</td><td>${o.name}</td><td style="direction:ltr;text-align:right;font-size:11px">${o.phone}</td><td>📍 ${o.area}</td><td>${deliveryBadge(o)}</td><td><strong>${o.total.toLocaleString()} ج</strong> ${paidBadge(o)}</td><td class="mwarn">${o.paid?'<span style="color:var(--success);font-size:11px">لا تحصيل</span>':o.ship||50+' ج'}</td><td>${cName(o.courierId)}</td><td>${sBadge(o.status)}</td><td><div style="display:flex;gap:4px;flex-wrap:wrap">${(!o.courierId&&o.status!=='مكتمل'&&o.status!=='ملغي')?`<button class="btn btn-primary btn-xs" onclick="openAssign('${o.id}')">📍 تعيين</button>`:''}${o.status!=='ملغي'?`<button class="btn btn-xs" style="background:${o.paid?'var(--warn-light)':'var(--success-light)'};color:${o.paid?'#92400e':'#065f46'};border:1px solid ${o.paid?'#fcd34d':'#86efac'}" onclick="togglePaid('${o.id}')">${o.paid?'↩️ COD':'💳 مدفوع'}</button>`:''}${o.status==='جاري التوصيل'?`<button class="btn btn-success btn-xs" onclick="markDone('${o.id}')">✓ تم</button>`:''}${(o.status!=='مكتمل'&&o.status!=='ملغي')?`<button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="cancelOrder('${o.id}')">إلغاء</button>`:''}</div></td></tr>`).join('');
}

function filterSt(btn,f){document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));btn.classList.add('on');orderFilter=f;orderTypeFilter=null;renderOrders()}
let orderTypeFilter=null;
function filterType(btn,t){document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));btn.classList.add('on');orderFilter='all';orderTypeFilter=t;renderOrders()}
function onSearch(q){searchQ=q;renderOrders()}

function renderCouriers(){
  $('courier-count').textContent=couriers.length+' مندوب';
  $('couriers-grid').innerHTML=couriers.map((c,i)=>{
    const active=oByC(c.id,'جاري التوصيل').length,done=oByC(c.id,'مكتمل').length,tot=active+done,rate=tot?Math.round(done/tot*100):0;
    return`<div class="cc"><div class="cc-av" style="background:${COLORS[i%COLORS.length]}">${c.name[0]}</div><div class="cc-name">${c.name}</div><div class="cc-info">📱 ${c.phone}</div><div class="cc-info">📍 ${c.zone}</div><div class="cc-info">🚗 ${c.vehicle}</div><div class="cc-info">💰 شحن: <strong>${c.ship} ج</strong></div><div class="cc-info" style="margin-top:5px">📦 نشط: <strong>${active}</strong> | مكتمل: <strong>${done}</strong></div><div class="pbar"><div class="pbar-f" style="width:${rate}%"></div></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
        <span class="cc-status s-active">${c.status}</span>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-xs" onclick="openEditCourier(${c.id})" style="color:var(--accent);border-color:var(--accent)">✏️ تعديل</button>
          <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="delCourier(${c.id})">✕</button>
        </div>
      </div></div>`}).join('');
  saveCouriers();refreshSelects();
}

function renderAssignPage(){
  // لا نعرض الـ pickup و transit في التوزيع
  const u=orders.filter(o=>!o.courierId&&!o.isBosta&&o.status!=='مكتمل'&&o.status!=='ملغي'&&!isPickup(o)&&!isTransit(o));
  $('assign-count').textContent=u.length+' طلب';
  const probCount=u.filter(o=>o.hasProblem).length;
  const probBtn=$('assign-prob-btn');
  if(probBtn){probBtn.style.display=probCount?'inline-flex':'none';probBtn.textContent='⚠️ '+probCount+' طلب مشكلة';}
  $('assign-tbody').innerHTML=u.map(o=>{
    const rankedCouriers=couriers.map(c=>{
      const zm=zoneMatchScore(o.area,c.zone);
      const active=oByC(c.id,'جاري التوصيل').length;
      return{...c,zs:zm.score,zm:zm.matched,zr:zm.reason,active};
    }).sort((a,b)=>b.zs-a.zs||(a.active-b.active));
    const areaShort=shortArea(o.area);
    return`<tr>
      <td style="text-align:center"><input type="checkbox" class="assign-chk" value="${o.id}" onchange="updateAssignBulkBtns()"></td>
      <td>
        <div style="font-weight:700;font-size:12px">${o.id}</div>
        <div style="margin-top:3px;font-size:10px;color:var(--muted)">${o.time||''}</div>
      </td>
      <td>${deliveryBadge(o)}</td>
      <td style="font-size:12px;font-weight:500">${o.name}</td>
      <td><span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:700">${areaShort}</span></td>
      <td style="font-size:11px;color:var(--muted);max-width:150px;line-height:1.6">${o.addr||o.area}</td>
      <td>
        <div style="font-weight:700">${o.total.toLocaleString()} ج</div>
        ${o.paid
          ? '<span style="background:var(--success-light);color:#065f46;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-top:3px;display:inline-block">💳 مدفوع</span>'
          : `<button class="btn btn-xs" style="margin-top:3px;background:var(--success-light);color:#065f46;border:1px solid #86efac;padding:2px 7px" onclick="event.stopPropagation();togglePaid('${o.id}')">💳 مدفوع</button>`
        }
      </td>
      <td style="min-width:220px">
        ${rankedCouriers.map((c,i)=>{
          const color=c.zs>=100?'#10b981':c.zs>=70?'#f59e0b':c.zs>=50?'#3b82f6':'#94a3b8';
          const rank=i===0&&c.zs>0?'🥇 ':i===1&&c.zs>0?'🥈 ':i===2&&c.zs>0?'🥉 ':'';
          return`<button class="btn btn-xs" style="background:${color};color:#fff;border:none;margin:1px;padding:3px 8px;font-size:10px;font-weight:700;opacity:${c.zs===0?0.35:1}" onclick="assignOrderId='${o.id}';selCAndConfirm(${c.id})" title="${c.zone}">
            ${rank}${c.name}
          </button>`;
        }).join('')}
        <button class="btn btn-xs" style="background:#6366f1;color:#fff;border:none;margin:1px;padding:3px 8px;font-size:10px;font-weight:700" onclick="assignToBosta('${o.id}')" title="توصيل عبر شركة بوسطة">🚚 بوسطة</button>
        <button class="btn btn-ghost btn-xs" style="font-size:10px;margin:1px" onclick="openAssign('${o.id}')">⋯</button>
        <button class="btn btn-xs" style="background:${o.hasProblem?'var(--warn)':'var(--bg)'};color:${o.hasProblem?'#fff':'var(--muted)'};border:1px solid ${o.hasProblem?'var(--warn)':'var(--border)'};font-size:10px;margin:1px" onclick="toggleProblem('${o.id}')" title="تحديد كمشكلة">⚠️</button>
      </td>
    </tr>`;
  }).join('');
}

// ===== ASSIGN =====
function openAssign(id){
  assignOrderId=id;selectedCourierId=null;
  const o=orders.find(x=>x.id===id);
  $('assign-title').textContent=`تعيين مندوب للطلب ${id}`;
  const isExpress=isSameDay(o);
  const suggested=suggestCourier(o);
  $('assign-info').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
      <div>
        <strong style="font-size:13px">${o.name}</strong> · 📱 ${o.phone}<br>
        📍 <strong>${o.area}</strong><br>
        💰 ${o.total.toLocaleString()} ج &nbsp;·&nbsp;
        <span style="font-weight:700;color:${isExpress?'var(--danger)':'var(--info)'}">${isExpress?'⚡ Same Day Delivery':'🚚 توصيل عادي'}</span>
        ${o.paid?'&nbsp;<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">💳 مدفوع - لا تحصيل</span>':''}
      </div>
      ${suggested?`<div style="background:#eef2ff;border:1.5px solid #a5b4fc;border-radius:9px;padding:10px 14px;font-size:12px;min-width:190px">
        <div style="font-size:10px;color:#6366f1;font-weight:700;margin-bottom:4px">🤖 مقترح بناءً على المنطقة</div>
        <div style="font-weight:800;font-size:14px;color:#3730a3">${suggested.name}</div>
        <div style="color:#6366f1;font-size:11px">📍 ${suggested.zone}</div>
        <div style="color:var(--muted);font-size:11px">📦 نشط: ${suggested.active} · مكتمل: ${suggested.done}</div>
        ${suggested.matchReason?`<div style="margin-top:5px;background:#dcfce7;border-radius:5px;padding:3px 8px;font-size:10px;color:#166534;font-weight:700;display:inline-block">📍 ${suggested.matchReason}${suggested.matchedZone?' — '+suggested.matchedZone:''}</div>`:''}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button onclick="selCAndConfirm(${suggested.id})" style="flex:1;background:var(--success);color:#fff;border:none;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Cairo,sans-serif">✅ تعيين</button>
          <button onclick="selC(${suggested.id});$('m-assign').classList.add('open')" style="flex:1;background:transparent;color:#6366f1;border:1px solid #6366f1;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Cairo,sans-serif">✎ تعديل</button>
        </div>
      </div>`:'<div style="font-size:11px;color:var(--muted);background:var(--bg);border-radius:8px;padding:10px 14px;text-align:center">لا يوجد مندوب مقترح<br>اختر يدوياً من القائمة</div>'}
    </div>`;
  $('assign-ship').value=o.ship||defaultShip;$('assign-note').value=o.note||'';
  renderAssignGrid();$('m-assign').classList.add('open');
}

function renderAssignGrid(){
  const g=$('assign-cgrid');if(!g)return;
  const o=orders.find(x=>x.id===assignOrderId);
  if(isPickup(o)){
    g.innerHTML='<div style="padding:16px;text-align:center;color:var(--purple);font-weight:600;font-size:13px">🏪 هذا الطلب للاستلام من المحل — لا يحتاج تعيين مندوب</div>';
    return;
  }
  const suggested=suggestCourier(o);
  g.innerHTML=couriers.map((c,i)=>{
    const active=oByC(c.id,'جاري التوصيل').length;
    const isSugg=suggested&&suggested.id===c.id;
    const isSelected=selectedCourierId==c.id;
    // درجة تطابق المنطقة
    const zm=o?zoneMatchScore(o.area,c.zone):{score:0,reason:'',matched:''};
    const zs=zm.score;
    const matchLabel=zs>=100?'🟢 تطابق تام':zs>=70?'🟡 تطابق جزئي':zs>=50?'🟠 تشابه':zs>0?'🔵 ممكن':'⚫ خارج منطقته';
    const borderStyle=zs>=100?'border-color:#10b981;box-shadow:0 0 0 2px rgba(16,185,129,.2)':zs>=70?'border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.15)':'';
    return`<div class="cc ${isSelected?'selected':''}" id="agc-${c.id}" onclick="selC(${c.id})" style="cursor:pointer;position:relative;${borderStyle}">
      ${isSugg?`<div style="position:absolute;top:-1px;left:-1px;background:#10b981;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px 0 8px 0">🤖 مقترح</div>`:''}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:${isSugg?'10px':'0'}">
        <div class="cc-av" style="background:${COLORS[i%COLORS.length]};width:32px;height:32px;font-size:13px">${c.name[0]}</div>
        <div><div class="cc-name" style="font-size:12px">${c.name}</div><div class="cc-info" style="font-size:10px">${c.zone}</div></div>
      </div>
      <div class="cc-info">📦 نشط: <strong>${active}</strong></div>
      <div class="cc-info">💰 عادي: <strong>${c.ship} ج</strong> | ⚡ <strong>${c.shipExpress||c.ship} ج</strong></div>
      <div style="margin-top:6px;font-size:10px;font-weight:700">${matchLabel}${zm.matched?' · '+zm.matched:''}</div>
    </div>`}).join('');
}

function selC(id){
  selectedCourierId=id;
  document.querySelectorAll('#assign-cgrid .cc').forEach(el=>el.classList.remove('selected'));
  $('agc-'+id)&&$('agc-'+id).classList.add('selected');
  const c=couriers.find(x=>x.id==id);
  const o=orders.find(x=>x.id===assignOrderId);
  if(c&&o) $('assign-ship').value=getShipCost(o,c);
}

async function selCAndConfirm(id){
  const o=orders.find(x=>x.id===assignOrderId);
  const c=couriers.find(x=>x.id==id);
  if(!o||!c) return;
  const ship=getShipCost(o,c);
  // تحديد المنطقة من مناطق المندوب
  const assignedZone = getOrderZoneForCourier(o, c);
  const upd={courierId:id,ship,note:'',status:'جاري التوصيل',assignedZone};
  Object.assign(o, upd);
  if(API_URL){apiFetch('/api/orders/'+assignOrderId,'PATCH',upd).catch(()=>{});}
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  c.status='نشط';

  // Shopify Fulfill: يدوي من صفحة بوسطة فقط

  pushNotif('🤖',`تعيين — ${c.name}`,`${assignOrderId} · ${o.name} · ${o.area}`);
  refreshAll();
  toast(`✅ تم تعيين ${c.name} للطلب ${assignOrderId} مباشرةً`);
}

async function confirmAssign(){
  if(!selectedCourierId){toast('❗ اختر مندوب أولاً');return}
  const o=orders.find(x=>x.id===assignOrderId);
  const c=couriers.find(x=>x.id==selectedCourierId);
  const ship=+$('assign-ship').value||getShipCost(o,c),note=$('assign-note').value;
  const upd={courierId:selectedCourierId,ship,note,status:'جاري التوصيل'};
  if(API_URL){const r=await apiFetch('/api/orders/'+assignOrderId,'PATCH',upd);if(r)Object.assign(o,r.order);else Object.assign(o,upd)}
  else Object.assign(o,upd);
  c.status='نشط';
  closeM('m-assign');
  pushNotif('🚴',`تم تعيين ${c.name}`,`الطلب ${assignOrderId} — ${o.name}`);
  refreshAll();toast(`✅ تم تعيين ${c.name} للطلب ${assignOrderId}`);
}

// ===== ORDER ACTIONS =====
function updateAssignBulkBtns(){
  const checked=document.querySelectorAll('.assign-chk:checked');
  const n=checked.length;
  $('assign-sel-count').textContent=n?n+' طلب محدد':'';
  const bulk=$('assign-bulk-actions');
  bulk.style.display=n?'flex':'none';
}

function assignToggleAll(val){
  document.querySelectorAll('.assign-chk').forEach(c=>c.checked=val);
  updateAssignBulkBtns();
}

function assignSelAll(){
  const all=document.querySelectorAll('.assign-chk');
  const anyUnchecked=[...all].some(c=>!c.checked);
  all.forEach(c=>c.checked=anyUnchecked);
  $('assign-check-all').checked=anyUnchecked;
  updateAssignBulkBtns();
}

async function assignBulkBosta(){
  const ids=[...document.querySelectorAll('.assign-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  if(!bostaApiKey){toast('❗ أدخل Bosta API Key في صفحة بوسطة أولاً');return;}
  let success=0,fail=0;
  toast('⏳ جاري رفع '+ids.length+' طلب على بوسطة...');
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(!o||o.bostaId)continue;
    try{
      const result=await createBostaDelivery(o);
      if(result.success){
        o.bostaId=result.deliveryId;
        o.bostaTrackingNo=result.trackingNumber;
        o.bostaStatus='created';
        o.status='جاري التوصيل';
        if(API_URL) await apiFetch('/api/orders/'+id,'PATCH',{bostaId:result.deliveryId,bostaTrackingNo:result.trackingNumber,bostaStatus:'created',status:'جاري التوصيل'});
        success++;
      }else fail++;
    }catch{fail++;}
  }
  pushNotif('🚚',`تم رفع ${success} طلب على بوسطة`,`${success} ناجح${fail?' · '+fail+' فاشل':''}`);
  refreshAll();
  toast(`✅ بوسطة: ${success} ناجح${fail?' · ❌ '+fail+' فاشل':''}`);
}

async function assignBulkCourier(){
  const cId=+$('assign-bulk-courier').value;
  if(!cId){toast('❗ اختر مندوب أولاً');return;}
  const ids=[...document.querySelectorAll('.assign-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  const c=couriers.find(x=>x.id===cId);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(!o)continue;
    const ship=getShipCost(o,c);
    const upd={courierId:cId,ship,status:'جاري التوصيل'};
    if(API_URL) await apiFetch('/api/orders/'+id,'PATCH',upd);
    Object.assign(o,upd);
  }
  c.status='نشط';
  pushNotif('🚴',`تم توزيع ${ids.length} طلب على ${c.name}`,ids.join('، '));
  refreshAll();
  toast(`✅ تم توزيع ${ids.length} طلب على ${c.name}`);
}

async function toggleProblem(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.hasProblem=!o.hasProblem;
  if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{hasProblem:o.hasProblem}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();
  toast(o.hasProblem?'⚠️ تم تحديد الطلب كمشكلة':'✅ تم إزالة علامة المشكلة');
}

async function assignToBosta(id){
  // تعيين الطلب لبوسطة فقط — بدون رفع بوليصة
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.courierId='bosta';
  o.isBosta=true;
  o.status='جاري التوصيل';
  const upd={courierId:null,isBosta:true,status:'جاري التوصيل'};
  if(API_URL)apiFetch('/api/orders/'+id,'PATCH',upd).catch(()=>{});
  // احفظ isBosta في localStorage كـ backup
  try{
    const bIds=JSON.parse(localStorage.getItem('bosta_ids')||'{}');
    bIds[id]=true;
    localStorage.setItem('bosta_ids',JSON.stringify(bIds));
    localStorage.setItem('orderpro_orders',JSON.stringify(orders));
  }catch(e){}
  refreshAll();
  pushNotif('🚚','تم تعيين طلب لبوسطة',id+' — '+o.name);
  toast('✅ تم تعيين الطلب لبوسطة — ارفع البوليصة يدوياً من صفحة بوسطة');
}

async function bostaCreateOne(id){
  // رفع البوليصة يدوياً من صفحة بوسطة
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  if(!bostaApiKey){
    toast('❗ أدخل Bosta API Key في صفحة بوسطة أولاً');
    goPage(document.querySelector('[data-p="bosta"]'),'bosta');
    return;
  }
  toast('⏳ جاري الرفع على بوسطة...');
  try{
    const result=await createBostaDelivery(o);
    if(result.success){
      o.bostaId=result.deliveryId;
      o.bostaTrackingNo=result.trackingNumber;
      o.bostaStatus='created';
      // حفظ البوليصة PDF
      if(result.awbBase64){
        o.bostaAwbBase64=result.awbBase64;
        // حفظ PDF تلقائياً
        downloadBostaPDF(result.awbBase64, id+'_bosta_'+result.trackingNumber+'.pdf');
      }
      const patch={bostaId:result.deliveryId,bostaTrackingNo:result.trackingNumber,bostaStatus:'created'};
      if(result.awbBase64) patch.bostaAwbBase64=result.awbBase64;
      if(API_URL) await apiFetch('/api/orders/'+id,'PATCH',patch).catch(()=>{});
      try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
      pushNotif('🚚','تم رفع بوليصة بوسطة',id+' — '+o.name+' — '+result.trackingNumber);
      refreshAll();
      if(result.awbBase64) toast('✅ تم الرفع وتحميل البوليصة PDF — '+result.trackingNumber);
      else toast('✅ تم الرفع — تتبع: '+result.trackingNumber);
    }else{
      toast('❌ فشل الرفع: '+(result.error||'خطأ'));
    }
  }catch(e){
    toast('❌ خطأ: '+e.message);
  }
}

function downloadBostaPDF(base64, filename){
  try{
    const link=document.createElement('a');
    link.href='data:application/pdf;base64,'+base64;
    link.download=filename||'bosta_awb.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }catch(e){ console.error('PDF download error:',e); }
}

async function assignBulkCancel(){
  const ids=[...document.querySelectorAll('.assign-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(!o)continue;
    o.status='ملغي';
    if(API_URL) await apiFetch('/api/orders/'+id,'PATCH',{status:'ملغي'});
  }
  refreshAll();
  toast(`❌ تم إلغاء ${ids.length} طلب`);
}

async function markPaid(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.paid=true;
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{paid:true});
  refreshAll();
  toast('💳 تم تحديد الطلب كمدفوع — المندوب مش هيحصّل');
}

async function togglePaid(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  // لو الطلب مدفوع من Shopify، لا نحوّله لـ COD تلقائياً
  if(o.paid && o.src==='shopify'){
    if(!confirm('هذا الطلب مدفوع من Shopify — هل أنت متأكد إنك عايز تحوّله لـ COD؟')) return;
  }
  o.paid=!o.paid;
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{paid:o.paid});
  refreshAll();
  toast(o.paid?'💳 تم تحديد الطلب كمدفوع':'💵 تم تحويل الطلب لـ COD');
}

async function markDone(id){
  const o=orders.find(x=>x.id===id);
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{status:'مكتمل'});
  o.status='مكتمل';
  pushNotif('✅','تم إتمام التوصيل',`الطلب ${id} — ${o.name}`);
  refreshAll();toast('✅ تم إتمام الطلب');
}

async function cancelOrder(id){
  const o=orders.find(x=>x.id===id);
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{status:'ملغي',courierId:null});
  o.status='ملغي';o.courierId=null;refreshAll();toast('❌ تم إلغاء الطلب');
}

async function addOrder(){
  const name=$('o-name').value.trim(),area=$('o-area').value.trim(),total=+$('o-total').value;
  if(!name||!area||!total){toast('❗ يرجى ملء الحقول المطلوبة');return}
  const phone=$('o-phone').value.trim(),ship=+$('o-ship').value||defaultShip,courierId=+$('o-courier').value||null;
  const data={name,phone:phone||'—',area,total,ship,courierId,status:courierId?'جاري التوصيل':'في الانتظار',note:''};
  let order;
  if(API_URL){const r=await apiFetch('/api/orders','POST',data);order=r?r.order:{id:'MN-'+(nextLocalId++),src:'manual',time:nowTime(),...data};if(r)orders.unshift(order)}
  else{order={id:'MN-'+(nextLocalId++),src:'manual',time:nowTime(),...data};orders.unshift(order)}
  closeM('m-order');['o-name','o-phone','o-area','o-details','o-total'].forEach(x=>$(x).value='');$('o-ship').value=50;
  pushNotif('📦','طلب يدوي جديد',`${order.id} — ${name} — ${total.toLocaleString()} ج`);
  refreshAll();toast(`✅ تم إضافة الطلب ${order.id}`);
}

function addCourier(){
  const name=$('c-name').value.trim(),phone=$('c-phone').value.trim();
  if(!name||!phone){toast('❗ الاسم والهاتف مطلوبان');return}
  const id=Math.max(0,...couriers.map(c=>c.id))+1;
  couriers.push({id,name,phone,zone:$('c-zone').value||'غير محدد',vehicle:$('c-vehicle').value,ship:+$('c-ship').value||50,shipExpress:+$('c-ship-express').value||80,status:'متاح',settled:false});
  closeM('m-courier');['c-name','c-phone','c-zone'].forEach(x=>$(x).value='');$('c-ship').value=50;$('c-ship-express').value=80;
  saveCouriers();refreshAll();toast(`✅ تم إضافة المندوب ${name}`);
}

async function delCourier(id){
  if(orders.some(o=>o.courierId==id&&o.status==='جاري التوصيل')){toast('❗ المندوب لديه طلبات نشطة');return}
  if(API_URL) await apiFetch('/api/couriers/'+id,'DELETE');
  couriers=couriers.filter(c=>c.id!==id);saveCouriers();refreshAll();toast('تم حذف المندوب');
}

let editingCourierId=null;

function openEditCourier(id){
  editingCourierId=id;
  const c=couriers.find(x=>x.id==id);
  if(!c)return;
  document.getElementById('edit-courier-title').textContent=`تعديل بيانات — ${c.name}`;
  document.getElementById('ec-name').value=c.name||'';
  document.getElementById('ec-phone').value=c.phone||'';
  document.getElementById('ec-zone').value=c.zone||'';
  document.getElementById('ec-ship').value=c.ship||50;
  document.getElementById('ec-ship-express').value=c.shipExpress||80;
  // تحديد وسيلة التنقل
  const vSel=document.getElementById('ec-vehicle');
  for(let i=0;i<vSel.options.length;i++){
    if(vSel.options[i].value===c.vehicle){vSel.selectedIndex=i;break;}
  }
  openM('m-edit-courier');
}

async function saveEditCourier(){
  const name=document.getElementById('ec-name').value.trim();
  const phone=document.getElementById('ec-phone').value.trim();
  if(!name||!phone){toast('❗ الاسم والهاتف مطلوبان');return}
  const c=couriers.find(x=>x.id==editingCourierId);
  if(!c)return;
  c.name=name; c.phone=phone;
  c.zone=document.getElementById('ec-zone').value.trim()||'غير محدد';
  c.vehicle=document.getElementById('ec-vehicle').value;
  c.ship=+document.getElementById('ec-ship').value||50;
  c.shipExpress=+document.getElementById('ec-ship-express').value||80;
  if(API_URL) await apiFetch('/api/couriers/'+editingCourierId,'PATCH',{name:c.name,phone:c.phone,zone:c.zone,vehicle:c.vehicle,ship:c.ship,shipExpress:c.shipExpress});
  saveCouriers();
  closeM('m-edit-courier');
  refreshAll();
  toast(`✅ تم تحديث بيانات ${name}`);
}

async function delCourierFromEdit(){
  if(orders.some(o=>o.courierId==editingCourierId&&o.status==='جاري التوصيل')){
    toast('❗ المندوب لديه طلبات نشطة — لا يمكن الحذف');return;
  }
  const c=couriers.find(x=>x.id==editingCourierId);
  const name=c?c.name:'';
  if(API_URL) await apiFetch('/api/couriers/'+editingCourierId,'DELETE');
  couriers=couriers.filter(c=>c.id!==editingCourierId);
  saveCouriers();closeM('m-edit-courier');refreshAll();
  toast(`🗑 تم حذف المندوب ${name}`);
}

function saveCouriers(){localStorage.setItem('op_couriers',JSON.stringify(couriers))}

// ===== ACCOUNTING =====
function renderAcc(){
  let totCod=0,totShip=0,rows='';
  couriers.forEach(c=>{
        const done=oByC(c.id,'مكتمل');
    const codOrders=done.filter(o=>!o.paid); // الطلبات اللي المندوب بيحصّلها
    const paidOrders=done.filter(o=>o.paid);  // الطلبات المدفوعة مسبقاً
    const cod=codOrders.reduce((a,o)=>a+o.total,0);
    const ship=done.reduce((a,o)=>a+(o.ship||50),0); // تمن الشحن على كل الطلبات
    const doneNorm=done.filter(o=>deliveryType(o)==='normal'),doneExp=done.filter(o=>isSameDay(o)),donePick=done.filter(o=>isPickup(o));
    const shipNorm=doneNorm.reduce((a,o)=>a+(o.ship||c.ship||50),0);
    const shipExp=doneExp.reduce((a,o)=>a+(o.ship||c.shipExpress||80),0);
    totCod+=cod;totShip+=ship;
    rows+=`<tr>
      <td><strong>${c.name}</strong><br><span style="font-size:10px;color:var(--muted)">${c.phone}</span></td>
      <td style="text-align:center">
        ${done.length} طلب<br>
        <span style="font-size:10px;color:var(--muted)">عادي: ${doneNorm.length} | سريع: ${doneExp.length}</span><br>
        ${paidOrders.length?`<span style="font-size:10px;color:var(--success)">💳 مدفوع: ${paidOrders.length}</span>`:''}
      </td>
      <td class="mpos">
        ${cod.toLocaleString()} ج<br>
        ${paidOrders.length?`<span style="font-size:10px;color:var(--success)">+${paidOrders.reduce((a,o)=>a+o.total,0).toLocaleString()} ج مدفوع</span>`:''}
      </td>
      <td class="mwarn">
        ${shipNorm.toLocaleString()} ج عادي<br>
        <span style="font-size:10px;color:var(--danger)">+${shipExp.toLocaleString()} ج سريع</span>
      </td>
      <td class="mpos">${(cod-ship).toLocaleString()} ج</td>
      <td class="mpurp">${ship.toLocaleString()} ج</td>
      <td>${c.settled?'<span class="badge b-done">✅ مسوّى</span>':'<span class="badge b-wait">⏳ لم يُسوَّ</span>'}</td>
      <td><div style="display:flex;gap:4px">
      ${(!c.settled&&done.length>0)?`<button class="btn btn-primary btn-xs" onclick="openSettle(${c.id})">تسوية</button>`:''}
      ${done.length>0?`<button class="btn btn-ghost btn-xs" onclick="printSettleSlip(${c.id})">🖨️ طباعة</button>`:''}
    </div></td>
    </tr>`;
  });
  $('acc-tbody').innerHTML=rows;
  $('acc-total').innerHTML=`<td colspan="2"><strong>الإجمالي</strong></td><td class="mpos">${totCod.toLocaleString()} ج</td><td class="mwarn">${totShip.toLocaleString()} ج</td><td class="mpos">${(totCod-totShip).toLocaleString()} ج</td><td class="mpurp">${totShip.toLocaleString()} ج</td><td colspan="2"></td>`;
  $('acc-cf').innerHTML='<option value="all">كل المناديب</option>'+couriers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  renderSettle();
}

function renderAccDet(){
  const f=$('acc-cf').value,list=orders.filter(o=>o.status==='مكتمل'&&o.courierId&&(f==='all'||o.courierId==f));
  $('acc-det-tbody').innerHTML=list.map(o=>{const c=couriers.find(x=>x.id==o.courierId),ship=o.ship||50,express=isSameDay(o);return`<tr><td><strong>${o.id}</strong></td><td>${c?c.name:'—'}</td><td>${o.name}</td><td>📍 ${o.area}</td><td><span class="badge ${express?'b-cancel':'b-go'}">${express?'⚡ سريع':'🚚 عادي'}</span></td><td class="mpos">${o.total.toLocaleString()} ج</td><td class="mwarn">${ship} ج</td><td class="mpos">${(o.total-ship).toLocaleString()} ج</td><td>${sBadge(o.status)}</td></tr>`}).join('');
}

function renderSettle(){
  $('settle-list').innerHTML=couriers.map(c=>{
    const done=oByC(c.id,'مكتمل'),cod=done.reduce((a,o)=>a+o.total,0),ship=done.reduce((a,o)=>a+(o.ship||50),0);
    if(!done.length)return'';
    return`<div style="border:1px solid var(--border);border-radius:9px;padding:13px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-weight:700;font-size:13px;margin-bottom:5px">${c.name}</div><div style="font-size:12px;color:var(--muted)">${done.length} طلب · COD: <strong style="color:var(--success)">${cod.toLocaleString()} ج</strong> · يستلم: <strong style="color:var(--purple)">${ship.toLocaleString()} ج</strong></div></div>${c.settled?'<span class="badge b-done">✅ مسوّى</span>':`<button class="btn btn-primary btn-sm" onclick="openSettle(${c.id})">تسوية الحساب</button>`}</div>`}).join('');
}

function accTab(tab,sec){document.querySelectorAll('.acc-tab').forEach(t=>t.classList.remove('on'));tab.classList.add('on');document.querySelectorAll('.acc-sec').forEach(s=>s.classList.remove('on'));$(sec).classList.add('on');if(sec==='acc-det')renderAccDet();if(sec==='acc-set')renderSettle()}

function openSettle(cId){
  settlingCourierId=cId;const c=couriers.find(x=>x.id==cId);
  const done=oByC(cId,'مكتمل');
  const codOrders=done.filter(o=>!o.paid),paidOrders=done.filter(o=>o.paid);
  const cod=codOrders.reduce((a,o)=>a+o.total,0); // اللي المندوب يجيبه
  const ship=done.reduce((a,o)=>a+(o.ship||50),0); // تمن الشحن الكلي
  $('settle-title').textContent=`تسوية حساب — ${c.name}`;
  $('settle-body').innerHTML=`
    <div class="settle-sum">
      <div><div class="settle-n" style="color:var(--success)">${cod.toLocaleString()} ج</div><div class="settle-l">COD يحصّله المندوب</div></div>
      <div><div class="settle-n" style="color:var(--warn)">${ship.toLocaleString()} ج</div><div class="settle-l">مستحق للمندوب</div></div>
      <div><div class="settle-n" style="color:var(--info)">${(cod-ship).toLocaleString()} ج</div><div class="settle-l">صافي المحل</div></div>
    </div>
    ${paidOrders.length?`<div style="background:var(--success-light);border:1px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">
      💳 <strong>${paidOrders.length} طلب مدفوع مسبقاً</strong> بإجمالي <strong>${paidOrders.reduce((a,o)=>a+o.total,0).toLocaleString()} ج</strong> — المندوب مش بيحصّلها
    </div>`:''}
    <p style="font-size:13px;margin-bottom:8px">سيدفع <strong>${c.name}</strong> مبلغ <strong style="color:var(--success);font-size:15px">${cod.toLocaleString()} ج</strong> (COD)</p>
    <p style="font-size:13px;color:var(--muted);margin-bottom:14px">ويستلم <strong style="color:var(--purple)">${ship.toLocaleString()} ج</strong> أجر توصيل (${done.length} طلب)</p>
    <div class="fg"><label>ملاحظات</label><textarea placeholder="ملاحظات..."></textarea></div>`;
  $('m-settle').classList.add('open');
}

function doSettle(){
  const c=couriers.find(x=>x.id==settlingCourierId);
  c.settled=true;
  if(API_URL)apiFetch('/api/couriers/'+c.id,'PATCH',{settled:true}).catch(()=>{});
  saveCouriers();
  closeM('m-settle');
  pushNotif('💰',`تمت تسوية حساب ${c.name}`,'');
  renderAcc();
  toast(`✅ تمت تسوية حساب ${c.name}`);
  // سؤال للطباعة
  setTimeout(()=>{
    if(confirm(`هل تريد طباعة ورقة تسوية ${c.name}؟`)) printSettleSlip(settlingCourierId);
  },300);
}

function printSettleSlip(cId){
  const c=couriers.find(x=>x.id==cId);
  if(!c)return;
  const done=oByC(cId,'مكتمل');
  const codOrders=done.filter(o=>!o.paid);
  const paidOrders=done.filter(o=>o.paid);
  const totalCod=codOrders.reduce((a,o)=>a+o.total,0);
  const totalShip=done.reduce((a,o)=>a+(o.ship||50),0);
  const netShop=totalCod-totalShip;
  const today=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const nowt=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:20px;font-size:12px;direction:rtl}
    h2{font-size:16px;margin-bottom:3px}
    .sub{font-size:11px;color:#666;margin-bottom:14px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;padding:10px;background:#f8faff;border-radius:6px;border:1px solid #e2e8f0}
    .sum-box{text-align:center}
    .sum-num{font-size:18px;font-weight:700}
    .sum-lbl{font-size:10px;color:#666;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#0f172a;color:#fff;padding:7px 9px;text-align:right;font-weight:600}
    td{padding:7px 9px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tr:nth-child(even) td{background:#f8faff}
    .total-row td{font-weight:700;background:#eef2ff!important;font-size:12px}
    .paid-badge{background:#dcfce7;color:#166534;padding:1px 6px;border-radius:10px;font-size:9px}
    .sig{display:flex;gap:50px;margin-top:24px}
    .sig-line{width:130px;border-bottom:1px solid #000;height:34px;margin-bottom:4px}
    .sig-lbl{font-size:10px;color:#666;text-align:center}
    @media print{body{padding:10px}}
  </style></head><body>
  <h2>💰 ورقة تسوية حساب — ${c.name}</h2>
  <div class="sub">${today} · ${nowt} · 📱 ${c.phone} · ${done.length} طلب</div>
  <div class="summary">
    <div class="sum-box"><div class="sum-num" style="color:#10b981">${done.length}</div><div class="sum-lbl">إجمالي الطلبات</div></div>
    <div class="sum-box"><div class="sum-num" style="color:#3b82f6">${totalCod.toLocaleString()} ج</div><div class="sum-lbl">إجمالي COD</div></div>
    <div class="sum-box"><div class="sum-num" style="color:#f59e0b">${totalShip.toLocaleString()} ج</div><div class="sum-lbl">تمن الشحن</div></div>
    <div class="sum-box"><div class="sum-num" style="color:#6366f1">${netShop.toLocaleString()} ج</div><div class="sum-lbl">صافي للمحل</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>رقم الطلب</th><th>العميل</th><th>المنطقة</th><th>إجمالي الطلب</th><th>الدفع</th><th>تمن الشحن</th><th>صافي المحل</th></tr></thead>
    <tbody>
      ${done.map((o,i)=>`<tr>
        <td>${i+1}</td>
        <td><strong>${o.id}</strong></td>
        <td>${o.name}</td>
        <td>${o.area}</td>
        <td><strong>${o.total.toLocaleString()} ج</strong></td>
        <td>${o.paid?'<span class="paid-badge">مدفوع</span>':'💵 COD'}</td>
        <td>${(o.ship||50).toLocaleString()} ج</td>
        <td>${(o.total-(o.ship||50)).toLocaleString()} ج</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4" style="text-align:left">الإجمالي</td>
        <td>${totalCod.toLocaleString()} ج</td>
        <td>${paidOrders.length?paidOrders.length+' مدفوع':''}</td>
        <td>${totalShip.toLocaleString()} ج</td>
        <td>${netShop.toLocaleString()} ج</td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top:14px;padding:10px;background:#eef2ff;border-radius:6px;font-size:12px">
    <strong>المندوب ${c.name} يُسلّم:</strong>
    ${totalCod.toLocaleString()} ج (COD) ← ويستلم: ${totalShip.toLocaleString()} ج (شحن)
    ← <strong style="color:#6366f1">صافي للمحل: ${netShop.toLocaleString()} ج</strong>
  </div>
  <div class="sig">
    <div><div class="sig-line"></div><div class="sig-lbl">توقيع المندوب</div></div>
    <div><div class="sig-line"></div><div class="sig-lbl">توقيع المشرف</div></div>
  </div>
  <div style="margin-top:16px;font-size:10px;color:#94a3b8;text-align:center">
    OrderPro · تسوية حساب ${c.name} · ${today}
  </div>
  <scr'+'ipt>window.onload=()=>window.print()<\/script><\/body><\/html>`);
  w.document.close();
}

// ===== PICKUP PAGE =====
function renderPickupPage(){
  updateLastPrintDisplay();
  const list=orders.filter(o=>isPickup(o));
  $('pickup-count').textContent=list.length+' طلب';
  updatePickupBulkBtns();
  $('pickup-tbody').innerHTML=list.length?list.map(o=>`
    <tr id="pickup-row-${o.id}">
      <td style="text-align:center"><input type="checkbox" class="pickup-chk" value="${o.id}" onchange="updatePickupBulkBtns()"></td>
      <td>
        <strong>${o.id}</strong><br>
        <span style="font-size:10px;color:var(--muted)">${o.time||''}</span>
      </td>
      <td>
        <strong>${o.name}</strong><br>
        <span style="font-size:10px;color:var(--muted)">${srcBadge(o.src)}</span>
      </td>
      <td style="font-size:11px;color:var(--muted);max-width:220px;line-height:1.6">${o.items||'—'}</td>
      <td><strong>${o.total.toLocaleString()} ج</strong></td>
      <td>${o.paid?'<span class="badge b-done">💳 مدفوع</span>':'<span class="badge b-wait">💵 COD</span>'}</td>
      <td>${sBadge(o.status)}</td>
      <td>
        <div style="display:flex;gap:4px">
          ${o.status==='جديد'||o.status==='في الانتظار'?`<button class="btn btn-success btn-xs" onclick="markPickedUp('${o.id}')">✅ استلم</button>`:''}
          ${o.status==='جديد'||o.status==='في الانتظار'?`<button class="btn btn-ghost btn-xs" style="color:var(--accent);border-color:var(--accent)" onclick="convertToDelivery('${o.id}')">🚚 شحن</button>`:''}
          ${o.status==='مكتمل'?`<button class="btn btn-ghost btn-xs" style="color:var(--warn);border-color:var(--warn)" onclick="undoPickup('${o.id}')">↩️ رجّع</button>`:''}
          ${o.status!=='مكتمل'&&o.status!=='ملغي'?`<button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="cancelOrder('${o.id}')">إلغاء</button>`:''}
        </div>
      </td>
    </tr>`).join('')
    :'<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--muted)">لا توجد طلبات للاستلام من المحل</td></tr>';
}

function updatePickupBulkBtns(){
  const checked=document.querySelectorAll('.pickup-chk:checked');
  const n=checked.length;
  $('pickup-sel-count').textContent=n?n+' محدد':'';
  $('pickup-bulk-done').style.display=n?'':'none';
  $('pickup-bulk-cancel').style.display=n?'':'none';
}

function pickupToggleAll(val){
  document.querySelectorAll('.pickup-chk').forEach(c=>{c.checked=val});
  updatePickupBulkBtns();
}

function pickupSelAll(){
  const all=document.querySelectorAll('.pickup-chk');
  const anyUnchecked=[...all].some(c=>!c.checked);
  all.forEach(c=>c.checked=anyUnchecked);
  $('pickup-check-all').checked=anyUnchecked;
  updatePickupBulkBtns();
}

function pickupBulkDone(){
  const ids=[...document.querySelectorAll('.pickup-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  ids.forEach(id=>{ const o=orders.find(x=>x.id===id); if(o){o.status='مكتمل';} });
  pushNotif('🏪',`تم استلام ${ids.length} طلب من المحل`,ids.join('، '));
  refreshAll();
  toast(`✅ تم تسجيل استلام ${ids.length} طلب`);
}

function pickupBulkCancel(){
  const ids=[...document.querySelectorAll('.pickup-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  ids.forEach(id=>{ const o=orders.find(x=>x.id===id); if(o){o.status='ملغي';} });
  refreshAll();
  toast(`❌ تم إلغاء ${ids.length} طلب`);
}

let lastPickupPrint = localStorage.getItem('lastPickupPrint')||null;

function printPickupSlip(mode='all'){
  let list;
  let title;
  const today=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  if(mode==='new'){
    // فقط الطلبات الجديدة بعد آخر طباعة
    const lastTime = lastPickupPrint ? new Date(lastPickupPrint) : null;
    list = orders.filter(o=>isPickup(o)&&o.status!=='ملغي'&&(!lastTime||new Date(o.createdAt||0)>lastTime));
    title = `قائمة استلام جديدة — منذ آخر طباعة`;
    if(!list.length){
      toast('لا توجد طلبات جديدة منذ آخر طباعة ('+(lastTime?lastTime.toLocaleString('ar-EG'):'لم تتم طباعة من قبل')+')');
      return;
    }
  } else {
    // كل الطلبات اللي لسا متسلمتش
    list = orders.filter(o=>isPickup(o)&&o.status!=='ملغي'&&o.status!=='مكتمل');
    title = `قائمة الطلبات المعلقة — غير المستلمة`;
    if(!list.length){toast('لا توجد طلبات معلقة للاستلام');return;}
  }

  // حفظ وقت الطباعة
  const printTime = new Date().toISOString();
  lastPickupPrint = printTime;
  localStorage.setItem('lastPickupPrint', printTime);

  const printTimeStr = new Date().toLocaleString('ar-EG');
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:16px;direction:rtl;font-size:12px}
    h2{font-size:16px;margin-bottom:3px}
    .sub{font-size:11px;color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}
    th{background:#0f172a;color:#fff;padding:7px 9px;text-align:right;font-weight:600;font-size:11px}
    td{padding:8px 9px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:11px}
    tr:nth-child(even) td{background:#f8faff}
    .total-row{font-weight:700;background:#eef2ff!important}
    .chk{width:18px;height:18px;border:1.5px solid #999;border-radius:3px;display:inline-block}
    @media print{body{padding:8px}}
  </style></head><body>
  <h2>🏪 ${title}</h2>
  <div class="sub">${today} · طُبع: ${printTimeStr} · ${list.length} طلب · إجمالي COD: ${list.filter(o=>!o.paid).reduce((s,o)=>s+o.total,0).toLocaleString()} ج</div>
  <table>
    <thead><tr><th style="width:20px">#</th><th style="width:80px">رقم الطلب</th><th style="width:100px">العميل</th><th>العنوان</th><th style="width:80px">الإجمالي</th><th style="width:60px">الدفع</th><th style="width:30px;text-align:center">✓</th></tr></thead>
    <tbody>
      ${list.map((o,i)=>`<tr>
        <td>${i+1}</td>
        <td><strong>${o.id}</strong></td>
        <td>${o.name}</td>
        <td style="color:#444">${o.addr||o.area||'—'}</td>
        <td><strong>${o.total.toLocaleString()} ج</strong></td>
        <td>${o.paid?'💳':'💵 COD'}</td>
        <td style="text-align:center"><div class="chk"></div></td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4" style="text-align:left">الإجمالي COD المطلوب تحصيله</td>
        <td>${list.filter(o=>!o.paid).reduce((s,o)=>s+o.total,0).toLocaleString()} ج</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top:20px;display:flex;gap:50px">
    <div style="text-align:center"><div style="width:130px;border-bottom:1px solid #000;height:32px;margin-bottom:4px"></div><div style="font-size:10px;color:#666">توقيع المسؤول</div></div>
    <div style="text-align:center"><div style="width:130px;border-bottom:1px solid #000;height:32px;margin-bottom:4px"></div><div style="font-size:10px;color:#666">توقيع العميل</div></div>
  </div>
  <scr'+'ipt>window.onload=()=>window.print()<\/script><\/body><\/html>`);
  w.document.close();
  updateLastPrintDisplay();
}

function updateLastPrintDisplay(){
  const el=document.getElementById('pickup-last-print');
  if(!el)return;
  const t=localStorage.getItem('lastPickupPrint');
  el.textContent=t?'آخر طباعة: '+new Date(t).toLocaleString('ar-EG'):'لم تتم طباعة بعد';
}

async function markPickedUp(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.status='مكتمل';
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{status:'مكتمل'}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();
  pushNotif('🏪','تم استلام طلب من المحل',`${id} — ${o.name}`);
  toast('✅ تم استلام الطلب — يظهر في محاسبة المحل');
}

// ===== TRANSIT PAGE =====
function renderTransitPage(){
  const list=orders.filter(o=>isTransit(o));
  $('transit-count').textContent=list.length+' طلب';
  updateTransitBulkBtns();
  $('transit-tbody').innerHTML=list.length?list.map(o=>`
    <tr>
      <td style="text-align:center"><input type="checkbox" class="transit-chk" value="${o.id}" onchange="updateTransitBulkBtns()"></td>
      <td><strong>${o.id}</strong><br><span style="font-size:10px;color:var(--muted)">${o.time||''}</span></td>
      <td>${srcBadge(o.src)}</td>
      <td><strong>${o.name}</strong></td>
      <td style="direction:ltr;text-align:right;font-size:11px">${o.phone||'—'}</td>
      <td style="font-size:11px;color:var(--muted);max-width:200px">${o.items||'—'}</td>
      <td><strong>${o.total.toLocaleString()} ج</strong></td>
      <td>${o.paid?'<span class="badge b-done">💳 مدفوع</span>':'<span class="badge b-wait">💵 COD</span>'}</td>
      <td>${sBadge(o.status)}</td>
      <td>
        <div style="display:flex;gap:4px">
          ${o.status==='جديد'||o.status==='في الانتظار'?`<button class="btn btn-primary btn-xs" onclick="markTransitReady('${o.id}')">📦 جاهز</button>`:''}
          ${o.status==='جاري التوصيل'?`<button class="btn btn-success btn-xs" onclick="markDone('${o.id}')">✅ تم</button>`:''}
          ${o.status!=='مكتمل'&&o.status!=='ملغي'?`<button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="cancelOrder('${o.id}')">إلغاء</button>`:''}
        </div>
      </td>
    </tr>`).join('')
    :'<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--muted)">لا توجد طلبات لمخزن العبور</td></tr>';
}

function updateTransitBulkBtns(){
  const checked=document.querySelectorAll('.transit-chk:checked');
  const n=checked.length;
  $('transit-sel-count').textContent=n?n+' محدد':'';
  $('transit-bulk-done').style.display=n?'':'none';
  $('transit-bulk-cancel').style.display=n?'':'none';
}

function transitToggleAll(val){
  document.querySelectorAll('.transit-chk').forEach(c=>c.checked=val);
  updateTransitBulkBtns();
}

function transitSelAll(){
  const all=document.querySelectorAll('.transit-chk');
  const anyUnchecked=[...all].some(c=>!c.checked);
  all.forEach(c=>c.checked=anyUnchecked);
  $('transit-check-all').checked=anyUnchecked;
  updateTransitBulkBtns();
}

function transitBulkDone(){
  const ids=[...document.querySelectorAll('.transit-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  ids.forEach(id=>{ const o=orders.find(x=>x.id===id); if(o) o.status='مكتمل'; });
  pushNotif('🏭',`تم تسليم ${ids.length} طلب من مخزن العبور`,ids.join('، '));
  refreshAll();
  toast(`✅ تم تسليم ${ids.length} طلب`);
}

function transitBulkCancel(){
  const ids=[...document.querySelectorAll('.transit-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  ids.forEach(id=>{ const o=orders.find(x=>x.id===id); if(o) o.status='ملغي'; });
  refreshAll();
  toast(`❌ تم إلغاء ${ids.length} طلب`);
}

function markTransitReady(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.status='جاري التوصيل';
  pushNotif('🏭','طلب مخزن العبور جاهز',`${id} — ${o.name} — جاهز للاستلام`);
  refreshAll();toast('📦 تم تحديث الطلب — جاهز للاستلام');
}

// ===== BOSTA =====
let bostaApiKey = localStorage.getItem('bosta_api_key')||'';
let bostaEnv = localStorage.getItem('bosta_env')||'production';
let bostaLocationId = localStorage.getItem('bosta_location_id')||'';
let bostaBusinessName = localStorage.getItem('bosta_business_name')||'';

const BOSTA_BASE = ()=>bostaEnv==='staging'?'https://staging.bostaapp.com/api/v0':'https://app.bosta.co/api/v0';

// طلب بوسطة = أي طلب مش من القاهرة/الجيزة (محافظات)
const CAIRO_AREAS = ['القاهرة','الجيزة','الإسكندرية','مدينة نصر','المعادي','الزمالك','6 أكتوبر','المهندسين','الدقي','حلوان','العباسية','المقطم','شبرا','إمبابة','الهرم','فيصل','الشروق','الرحاب','التجمع','مدينة بدر','العبور','بدر'];
function isGovernorate(o){
  // بس للكشف عن المنطقة — مش للعرض في الصفحة
  const area=(o.area||'').toLowerCase();
  const isCairo=CAIRO_AREAS.some(a=>area.includes(a.toLowerCase()));
  return !isCairo && !isPickup(o) && !isTransit(o);
}
function isBostaOrder(o){
  // طلبات بوسطة = اللي اتوزعت على بوسطة يدوياً فقط
  return !!o.bostaId;
}

function toggleBostaSetup(){
  const f=$('bosta-setup-form');
  f.style.display=f.style.display==='none'?'block':'none';
  if(f.style.display==='block'){
    $('bosta-api-key').value=bostaApiKey;
    $('bosta-env').value=bostaEnv;
    $('bosta-location-id').value=bostaLocationId;
    $('bosta-business-name').value=bostaBusinessName;
    if($('bosta-pickup-address'))$('bosta-pickup-address').value=bostaPickupAddress;
    if($('bosta-pickup-city'))$('bosta-pickup-city').value=bostaPickupCity;
  }
}

let bostaPickupAddress = localStorage.getItem('bosta_pickup_address')||'';
let bostaPickupCity = localStorage.getItem('bosta_pickup_city')||'القاهرة';

function saveBostaSettings(){
  bostaApiKey=$('bosta-api-key').value.trim();
  bostaEnv=$('bosta-env').value;
  bostaLocationId=$('bosta-location-id').value.trim();
  bostaBusinessName=$('bosta-business-name').value.trim();
  bostaPickupAddress=$('bosta-pickup-address').value.trim();
  bostaPickupCity=$('bosta-pickup-city').value.trim()||'القاهرة';
  localStorage.setItem('bosta_api_key',bostaApiKey);
  localStorage.setItem('bosta_env',bostaEnv);
  localStorage.setItem('bosta_location_id',bostaLocationId);
  localStorage.setItem('bosta_business_name',bostaBusinessName);
  localStorage.setItem('bosta_pickup_address',bostaPickupAddress);
  localStorage.setItem('bosta_pickup_city',bostaPickupCity);
  $('bosta-conn-status').textContent='⏳ جاري الاتصال...';
  testBostaConnection();
}

async function testBostaConnection(){
  if(!bostaApiKey){$('bosta-conn-status').textContent='❗ أدخل الـ API Key';return;}
  if(!API_URL){$('bosta-conn-status').textContent='❗ الـ Backend مش متصل';return;}
  try{
    $('bosta-conn-status').textContent='⏳ جاري الاتصال...';
    const r=await fetch(API_URL+'/api/bosta/test',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({apiKey:bostaApiKey,env:bostaEnv})
    });
    const data=await r.json();
    if(data.success){
      $('bosta-conn-status').textContent='✅ '+data.message;
      $('bosta-conn-status').style.color='var(--success)';
      $('bosta-setup-banner').style.background='linear-gradient(135deg,#10b981,#059669)';
      $('bosta-setup-banner').querySelector('div').innerHTML='<div style="font-size:15px;font-weight:700;margin-bottom:3px">✅ بوسطة متصلة</div><div style="font-size:12px;opacity:.85">عدد الـ pickup locations: '+( data.locations||0)+'</div>';
    }else{
      throw new Error(data.error||'HTTP error');
    }
  }catch(e){
    $('bosta-conn-status').textContent='❌ '+e.message;
    $('bosta-conn-status').style.color='var(--danger)';
  }
}

function renderBostaPage(){
  // الصفحة دي بتعرض بس الطلبات اللي رُفعت على بوسطة يدوياً
  const bostaOrders=orders.filter(o=>o.bostaId); // مرفوعة أو معينة
  // الطلبات المعينة لبوسطة فقط (courierId='bosta') واللي لم ترفع بعد
  const allOrders=orders.filter(o=>(o.isBosta||String(o.courierId)==='bosta')&&!o.bostaId&&o.status!=='ملغي');
  const sent=bostaOrders;
  const inProgress=bostaOrders.filter(o=>o.bostaStatus==='in-progress'||o.bostaStatus==='picked-up');

  $('bosta-total').textContent=allOrders.length;
  $('bosta-pending').textContent=allOrders.length;
  $('bosta-sent').textContent=sent.length;
  $('bosta-inprogress').textContent=inProgress.length;
  $('bosta-count').textContent=bostaOrders.length+' طلب مرفوع';
  if($('nb-bosta'))$('nb-bosta').textContent=bostaOrders.length||'';

  // فلتر العرض
  const bFilter = window.bostaFilter||'sent';
  const displayOrders = bFilter==='pending' ? allOrders
    : bostaOrders;

  $('bosta-tbody').innerHTML=displayOrders.length?displayOrders.map(o=>{
    const statusBadge=o.bostaId
      ?`<div style="font-size:11px"><span style="background:var(--success-light);color:#065f46;padding:2px 7px;border-radius:10px;font-weight:700">✅ مرفوعة</span><br><span style="font-size:10px;color:var(--muted);font-family:monospace">${o.bostaTrackingNo||o.bostaId}</span></div>`
      :'<span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700">⏳ لم ترفع</span>';
    return`<tr>
      <td style="text-align:center"><input type="checkbox" class="bosta-chk" value="${o.id}" onchange="updateBostaBulkBtn()"></td>
      <td><strong>${o.id}</strong><br>${deliveryBadge(o)}</td>
      <td><strong>${o.name}</strong></td>
      <td style="direction:ltr;text-align:right;font-size:11px">${o.phone||'—'}</td>
      <td><span style="background:var(--info-light);color:#1e3a5f;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${o.area}</span></td>
      <td style="font-size:11px;color:var(--muted)">${o.addr||o.area}</td>
      <td><strong>${o.total.toLocaleString()} ج</strong><br>${o.paid?'<span style="font-size:10px;color:var(--success)">مدفوع</span>':'<span style="font-size:10px;color:var(--warn)">COD</span>'}</td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${!o.bostaId?`<button class="btn btn-primary btn-xs" onclick="bostaCreateOne('${o.id}')">🚀 رفع</button>`:''}
          ${o.bostaId?`<button class="btn btn-ghost btn-xs" onclick="openBostaAWB('${o.id}')">🖨️ بوليصة</button>`:''}
          ${o.bostaId?`<button class="btn btn-ghost btn-xs" onclick="bostaTrackOne('${o.id}')">📍 تتبع</button>`:''}
          <button class="btn btn-ghost btn-xs" style="color:var(--warn);border-color:var(--warn)" onclick="unassignBosta('${o.id}')">↩️ إلغاء</button>
        </div>
      </td>
    </tr>`;
  }).join(''):`<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted)">${bFilter==='pending'?'كل الطلبات مرفوعة ✅':bFilter==='sent'?'لا توجد طلبات مرفوعة بعد':'لا توجد طلبات محافظات'}</td></tr>`;
}

function updateBostaBulkBtn(){
  const checked=[...document.querySelectorAll('.bosta-chk:checked')];
  const n=checked.length;
  const info=$('bosta-sel-info');
  if(info) info.textContent=n?n+' طلب محدد':'';
  $('bosta-bulk-btn').style.display=n?'inline-block':'none';
  if($('bosta-export-btn'))$('bosta-export-btn').style.display=n?'inline-block':'none';
  if(n) $('bosta-bulk-btn').textContent='🚀 رفع '+n+' طلب على بوسطة';
}

function bostaSetFilter(f, btn){
  window.bostaFilter=f;
  document.querySelectorAll('#bosta-filter-sent,#bosta-filter-pending').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  renderBostaPage();
}

function bostaSelAll(){
  const all=document.querySelectorAll('.bosta-chk');
  const any=[...all].some(c=>!c.checked);
  all.forEach(c=>c.checked=any);
  $('bosta-check-all').checked=any;
  updateBostaBulkBtn();
}

function bostaToggleAll(val){
  document.querySelectorAll('.bosta-chk').forEach(c=>c.checked=val);
  updateBostaBulkBtn();
}


async function bostaCreateBulk(){
  const ids=[...document.querySelectorAll('.bosta-chk:checked')].map(c=>c.value);
  if(!ids.length)return;
  if(!bostaApiKey){toast('❗ أدخل Bosta API Key في الإعدادات');return;}
  let success=0,fail=0;
  toast('⏳ جاري رفع '+ids.length+' طلب على بوسطة...');
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(!o||o.bostaId) continue;
    try{
      const result=await createBostaDelivery(o);
      if(result.success){o.bostaId=result.deliveryId;o.bostaTrackingNo=result.trackingNumber;o.bostaStatus='created';success++;}
      else fail++;
    }catch{fail++;}
  }
  refreshAll();
  toast(`✅ تم رفع ${success} طلب${fail?' · ❌ فشل '+fail:''}  على بوسطة`);
  pushNotif('🚚',`تم رفع ${success} طلب على بوسطة`,`${success} ناجح${fail?' · '+fail+' فاشل':''}`);
}

async function createBostaDelivery(o){
  if(!API_URL){
    toast('❗ الـ Backend مش متصل — محتاج تربط الـ Backend عشان تستخدم بوسطة');
    return{success:false,error:'Backend not connected'};
  }
  // نبعت الطلب للـ Backend بتاعنا اللي يتواصل مع بوسطة (تفادياً لـ CORS)
  const r=await fetch(API_URL+'/api/bosta/create',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      apiKey:bostaApiKey,
      env:bostaEnv,
      locationId:bostaLocationId,
      order:{...o, pickupAddress:bostaPickupAddress, pickupCity:bostaPickupCity, businessName:bostaBusinessName}
    })
  });
  const data=await r.json();
  if(data.success){
    // جيب البوليصة PDF بعد النجاح
    let awbBase64 = data.awbBase64 || null;
    if(!awbBase64 && data.deliveryId){
      try{
        const awbR = await fetch(API_URL+'/api/bosta/awb',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({apiKey:bostaApiKey,env:bostaEnv,deliveryId:data.deliveryId})
        });
        const awbData = await awbR.json();
        if(awbData.success) awbBase64 = awbData.base64;
      }catch(e){}
    }
    return{success:true,deliveryId:data.deliveryId,trackingNumber:data.trackingNumber,hasAwb:!!awbBase64,awbBase64};
  }
  return{success:false,error:data.error||'خطأ غير معروف'};
}

async function openBostaAWB(id){
  const o=orders.find(x=>x.id===id);
  if(!o){toast('❗ الطلب مش موجود');return;}

  // لو في AWB محفوظ في الـ order مباشرةً
  if(o.bostaAwbBase64){
    const w=window.open('','_blank');
    w.document.write('<html><body style="margin:0"><embed width="100%" height="100%" src="data:application/pdf;base64,'+o.bostaAwbBase64+'" type="application/pdf"><\/body><\/html>');
    return;
  }

  // جرب تجيبه من الـ Backend
  if(API_URL&&o.bostaId){
    toast('⏳ جاري جلب البوليصة من قاعدة البيانات...');
    try{
      const r=await apiFetch('/api/bosta/awb/'+id);
      if(r&&r.success&&r.awbBase64){
        o.bostaAwbBase64=r.awbBase64;
        const w=window.open('','_blank');
        w.document.write('<html><body style="margin:0"><embed width="100%" height="100%" src="data:application/pdf;base64,'+r.awbBase64+'" type="application/pdf"><\/body><\/html>');
        toast('✅ تم فتح البوليصة');
        return;
      }
    }catch(e){console.log('AWB fetch error:',e);}
  }

  // fallback لصفحة بوسطة
  if(o.bostaId){
    window.open('https://business.bosta.co/deliveries/'+o.bostaId,'_blank');
    toast('⚠️ البوليصة مش محفوظة — افتح بوسطة يدوياً');
  }else{
    toast('❗ الطلب مش مرفوع على بوسطة بعد');
  }
}

async function openBostaAWB(id){
  const o=orders.find(x=>x.id===id);
  if(!o){toast('❗ الطلب مش موجود');return;}
  // لو في AWB محفوظ في الـ order
  if(o.bostaAwbBase64){
    const w=window.open('','_blank');
    w.document.write('<html><body style="margin:0"><embed width="100%" height="100%" src="data:application/pdf;base64,'+o.bostaAwbBase64+'" type="application/pdf"><\/body><\/html>');
    return;
  }
  // جلبه من Backend
  if(API_URL&&o.bostaId){
    toast('⏳ جاري جلب البوليصة...');
    try{
      const r=await apiFetch('/api/bosta/awb/'+id);
      if(r&&r.success&&r.awbBase64){
        o.bostaAwbBase64=r.awbBase64;
        const w=window.open('','_blank');
        w.document.write('<html><body style="margin:0"><embed width="100%" height="100%" src="data:application/pdf;base64,'+r.awbBase64+'" type="application/pdf"><\/body><\/html>');
        toast('✅ تم فتح البوليصة');
        return;
      }
    }catch(e){}
  }
  // fallback
  if(o.bostaId) window.open('https://business.bosta.co/deliveries/'+o.bostaId,'_blank');
  else toast('❗ الطلب مش مرفوع على بوسطة بعد');
}

async function bostaTrackOne(id){
  const o=orders.find(x=>x.id===id);
  if(!o||!o.bostaTrackingNo)return;
  window.open('https://app.bosta.co/tracking/'+o.bostaTrackingNo,'_blank');
}

// ===== COURIER ORDERS PAGE =====
let activeCourierTab = null;

function renderCourierOrdersPage(){
  const tabs = $('courier-tabs');
  const content = $('courier-orders-content');
  if(!couriers.length){
    content.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">لا يوجد مناديب مضافين</div>';
    return;
  }

  // أول مرة — اختار أول مندوب
  if(!activeCourierTab || !couriers.find(c=>c.id==activeCourierTab)){
    activeCourierTab = couriers[0].id;
  }

  // tabs
  tabs.innerHTML = couriers.map((c,i)=>{
    const active = oByC(c.id,'جاري التوصيل').length;
    const isActive = c.id == activeCourierTab;
    return `<button onclick="activeCourierTab=${c.id};renderCourierOrdersPage()"
      style="padding:8px 16px;border-radius:8px;border:1.5px solid ${isActive?'var(--accent)':'var(--border)'};
      background:${isActive?'var(--accent)':'var(--card)'};color:${isActive?'#fff':'var(--text)'};
      font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer">
      ${c.name}
      ${active?`<span style="background:${isActive?'rgba(255,255,255,.3)':'var(--warn-light)'};color:${isActive?'#fff':'var(--warn)'};padding:1px 7px;border-radius:10px;margin-right:4px;font-size:11px">${active}</span>`:''}
    </button>`;
  }).join('');

  // الطلبات للمندوب المختار
  const c = couriers.find(x=>x.id==activeCourierTab);
  if(!c){ content.innerHTML=''; return; }

  const cOrders = orders.filter(o=>o.courierId==c.id&&o.status!=='ملغي');
  const active = cOrders.filter(o=>o.status==='جاري التوصيل');
  const done = cOrders.filter(o=>o.status==='مكتمل');

  content.innerHTML = `
    <div class="card">
      <div class="card-hd">
        <h3>🚴 ${c.name} — طلباته</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="chip on" id="co-tab-all-${c.id}" onclick="coFilter('all',${c.id})">الكل (${cOrders.length})</button>
          <button class="chip" id="co-tab-active-${c.id}" onclick="coFilter('active',${c.id})">📦 نشط (${active.length})</button>
          <button class="chip" id="co-tab-done-${c.id}" onclick="coFilter('done',${c.id})">✅ مكتمل (${done.length})</button>
          <span style="font-size:11px;color:var(--muted);margin-right:auto">📱 ${c.phone}</span>
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:30px"></th>
            <th>رقم الطلب</th>
            <th>نوع</th>
            <th>العميل</th>
            <th>المنطقة</th>
            <th>منطقة المندوب</th>
            <th>العنوان</th>
            <th>COD</th>
            <th>الحالة</th>
            <th>إجراءات</th>
          </tr></thead>
          <tbody id="co-tbody-${c.id}">
            ${cOrders.length ? cOrders.map(o=>{
            const dz=o.assignedZone||getOrderZoneForCourier(o,c)||'أخري';
            return `<tr>
                <td style="text-align:center"><input type="checkbox" class="co-chk" value="${o.id}" data-cid="${c.id}" onchange="updateCoBulk(${c.id})"></td>
                <td><strong>${o.id}</strong><br><span style="font-size:10px;color:var(--muted)">${o.time||''}</span></td>
                <td>${deliveryBadge(o)}</td>
                <td><strong>${o.name}</strong><br><span style="font-size:10px;color:var(--muted);direction:ltr">${o.phone||''}</span></td>
                <td><span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:700">${shortArea(o.area)}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:4px">
                    <span id="zone-label-${o.id}" style="background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${dz}</span>
                    <button class="btn btn-ghost btn-xs" style="font-size:10px;padding:2px 6px" onclick="openZoneEdit('${o.id}',${c.id})">✏️</button>
                  </div>
                </td>
                <td style="font-size:11px;color:var(--muted);max-width:130px">${o.addr||o.area}</td>
                <td><strong>${o.paid?'<span style="color:var(--success)">مدفوع</span>':(o.total.toLocaleString()+' ج')}</strong></td>
                <td>${sBadge(o.status)}</td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${o.status!=='مكتمل'?`<button class="btn btn-ghost btn-xs" style="color:var(--warn);border-color:var(--warn)" onclick="unassignOrder('${o.id}')">↩️ إلغاء</button>`:''}
                    ${o.status!=='مكتمل'?`<button class="btn btn-ghost btn-xs" onclick="reassignOrder('${o.id}')">🔄 تعيين</button>`:''}
                    ${o.status==='جاري التوصيل'?`<button class="btn btn-success btn-xs" onclick="markDone('${o.id}')">✅ تم</button>`:''}
                    ${o.status==='مكتمل'?`<button class="btn btn-ghost btn-xs" style="color:var(--accent);border-color:var(--accent)" onclick="undoComplete('${o.id}')">↩️ رجّع</button>`:''}
                    ${(!o.paid&&o.status==='مكتمل')?`<button class="btn btn-xs" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-size:10px" onclick="markPaidFromCourier('${o.id}')">💰 تحويل لمدفوع</button>`:''}
                    ${(!o.paid&&o.status!=='مكتمل')?`<button class="btn btn-xs" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-size:10px" onclick="markPaidFromCourier('${o.id}')">💰 بدون تحصيل</button>`:''}
                    ${o.paid?`<span style="background:var(--success-light);color:#065f46;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">💳 مدفوع</span>`:''}
                  </div>
                </td>
              </tr>`;
          }).join('')
            : '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted)">لا توجد طلبات لهذا المندوب</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function coFilter(f, cId){
  const c = couriers.find(x=>x.id==cId);
  if(!c) return;
  const allOrders = orders.filter(o=>o.courierId==c.id&&o.status!=='ملغي');
  const filtered = f==='active' ? allOrders.filter(o=>o.status==='جاري التوصيل')
    : f==='done' ? allOrders.filter(o=>o.status==='مكتمل')
    : allOrders;
  // تحديث tabs
  ['all','active','done'].forEach(t=>{
    const btn=document.getElementById('co-tab-'+t+'-'+cId);
    if(btn) btn.classList.toggle('on', t===f);
  });
  // تحديث الجدول
  const tbody=document.getElementById('co-tbody-'+cId);
  if(!tbody) return;
  tbody.innerHTML = filtered.length ? filtered.map(o=>{
    const displayZone = o.assignedZone || getOrderZoneForCourier(o,c) || 'أخري';
    return `
    <tr>
      <td style="text-align:center"><input type="checkbox" class="co-chk" value="${o.id}" data-cid="${cId}" onchange="updateCoBulk(${cId})"></td>
      <td><strong>${o.id}</strong><br><span style="font-size:10px;color:var(--muted)">${o.time||''}</span></td>
      <td>${deliveryBadge(o)}</td>
      <td><strong>${o.name}</strong><br><span style="font-size:10px;color:var(--muted);direction:ltr">${o.phone||''}</span></td>
      <td><span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:700">${shortArea(o.area)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:4px">
          <span id="zone-label-${o.id}" style="background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${displayZone}</span>
          <button class="btn btn-ghost btn-xs" style="font-size:10px;padding:2px 6px" onclick="openZoneEdit('${o.id}',${cId})">✏️</button>
        </div>
      </td>
      <td style="font-size:11px;color:var(--muted);max-width:130px;line-height:1.6">${o.addr||o.area}</td>
      <td><strong>${o.paid?'<span style="color:var(--success)">مدفوع</span>':(o.total.toLocaleString()+' ج')}</strong></td>
      <td>${sBadge(o.status)}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${o.status!=='مكتمل'?`<button class="btn btn-ghost btn-xs" style="color:var(--warn);border-color:var(--warn)" onclick="unassignOrder('${o.id}')">↩️ إلغاء</button>`:''}
          ${o.status!=='مكتمل'?`<button class="btn btn-ghost btn-xs" onclick="reassignOrder('${o.id}')">🔄 تعيين</button>`:''}
          ${o.status==='جاري التوصيل'?`<button class="btn btn-success btn-xs" onclick="markDone('${o.id}')">✅ تم</button>`:''}
          ${o.status==='مكتمل'?`<button class="btn btn-ghost btn-xs" style="color:var(--accent);border-color:var(--accent)" onclick="undoComplete('${o.id}')">↩️ رجّع</button>`:''}
          ${(!o.paid&&o.status==='مكتمل')?`<button class="btn btn-xs" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-size:10px" onclick="markPaidFromCourier('${o.id}')">💰 تحويل لمدفوع</button>`:''}
          ${(!o.paid&&o.status!=='مكتمل')?`<button class="btn btn-xs" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-size:10px" onclick="markPaidFromCourier('${o.id}')">💰 بدون تحصيل</button>`:''}
          ${o.paid?`<span style="background:var(--success-light);color:#065f46;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">💳 مدفوع</span>`:''}
        </div>
      </td>
    </tr>`;
  }).join('')
    : '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted)">لا توجد طلبات</td></tr>';
}

// ===== BULK في صفحة المناديب =====
function updateCoBulk(cId){
  const chks=[...document.querySelectorAll(`.co-chk[data-cid="${cId}"]:checked`)];
  const bar=document.getElementById('co-bulk-bar-'+cId);
  const cnt=document.getElementById('co-bulk-count-'+cId);
  if(bar){bar.style.display=chks.length?'flex':'none';}
  if(cnt)cnt.textContent=chks.length+' طلب محدد';
}
function coToggleAll(val,cId){
  document.querySelectorAll(`.co-chk[data-cid="${cId}"]`).forEach(c=>c.checked=val);
  updateCoBulk(cId);
}
function coDeselectAll(cId){
  document.querySelectorAll(`.co-chk[data-cid="${cId}"]`).forEach(c=>c.checked=false);
  updateCoBulk(cId);
}
async function coBulkDone(cId){
  const ids=[...document.querySelectorAll(`.co-chk[data-cid="${cId}"]:checked`)].map(c=>c.value);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o&&o.status!=='مكتمل'){o.status='مكتمل';if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{status:'مكتمل'}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('✅ تم تحديد '+ids.length+' طلب كمكتمل');
}
async function coBulkUndo(cId){
  const ids=[...document.querySelectorAll(`.co-chk[data-cid="${cId}"]:checked`)].map(c=>c.value);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o){o.status='جاري التوصيل';if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{status:'جاري التوصيل'}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('↩️ تم رجوع '+ids.length+' طلب لنشط');
}
async function coBulkPaid(cId){
  const ids=[...document.querySelectorAll(`.co-chk[data-cid="${cId}"]:checked`)].map(c=>c.value);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o&&!o.paid){o.paid=true;if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{paid:true}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('💳 تم تحويل '+ids.length+' طلب لمدفوع');
}
async function coBulkUnassign(cId){
  const ids=[...document.querySelectorAll(`.co-chk[data-cid="${cId}"]:checked`)].map(c=>c.value);
  if(!confirm('هتلغي تعيين '+ids.length+' طلب؟'))return;
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o){o.courierId=null;o.status='جديد';if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{courierId:null,status:'جديد'}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('🔓 تم إلغاء تعيين '+ids.length+' طلب');
}

async function undoComplete(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.status='جاري التوصيل';
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{status:'جاري التوصيل'}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();
  renderCourierOrdersPage();
  toast('↩️ تم رجوع الطلب '+id+' لـ "جاري التوصيل"');
}

async function markPaidFromCourier(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.paid=true;
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{paid:true}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();
  renderCourierOrdersPage();
  toast('💳 تم تحويل الطلب '+id+' لـ "مدفوع" — المندوب مش هيتحاسب عليه كتحصيل');
}

async function unassignOrder(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  const cName = couriers.find(c=>c.id==o.courierId)?.name||'';
  o.courierId=null;
  o.status='جديد';
  o.ship=50;
  if(API_URL)await apiFetch('/api/orders/'+id,'PATCH',{courierId:null,status:'جديد',ship:50});
  refreshAll();
  toast(`↩️ تم إلغاء تعيين الطلب ${id} من ${cName}`);
}

function reassignOrder(id){
  // فتح نافذة التعيين مع اختيار مندوب جديد
  openAssign(id);
}

// ===== استيراد Excel =====
let parsedExcelOrders = [];

function renderImportExcelPage(){
  const sel = $('import-courier-sel');
  if(sel){
    sel.innerHTML = '<option value="">— اختر المندوب —</option>' +
      couriers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  }
  $('import-preview').style.display='none';
  $('import-excel-btn').style.display='none';
  $('import-result').textContent='';
  parsedExcelOrders=[];
}

function handleExcelFile(input){
  const file = input.files[0];
  if(!file) return;

  // اقترح المندوب من اسم الملف
  const fname = file.name.replace('.xlsx','').replace('.xls','').replace('_',' ').trim();
  const sel = $('import-courier-sel');
  if(sel && couriers.length){
    const matched = couriers.find(c=>{
      const cn=(c.name||'').toLowerCase();
      const fn=fname.toLowerCase();
      return cn.includes(fn)||fn.includes(cn)||
             cn.split(' ').some(w=>w.length>2&&fn.includes(w));
    });
    if(matched) sel.value=matched.id;
  }

  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const wb = XLSX.read(e.target.result, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

      // تخطى الصف الأول (header)
      const dataRows = rows.slice(1).filter(r=>r[0]&&String(r[0]).trim());

      parsedExcelOrders = dataRows.map(r=>{
        const orderNum = String(r[0]||'').trim().replace(/[^0-9]/g,'');
        if(!orderNum) return null;
        const areaRaw = String(r[4]||'').trim();
        const isExpress = areaRaw.includes('مستعجل');
        const area = areaRaw.replace('مستعجل','').trim();
        const phone = String(r[2]||'').replace(/[^0-9]/g,'');
        const finalPhone = phone.startsWith('20')? '0'+phone.slice(2) : phone;
        return {
          id:'SH-'+orderNum,
          shopifyId:orderNum, src:'shopify',
          name:String(r[1]||'').trim(),
          phone:finalPhone,
          area, addr:String(r[5]||'').replace(/\n/g,' ').trim().slice(0,150),
          total:parseFloat(String(r[3]||'0').replace(/,/g,''))||0,
          ship:50, paid:false, status:'مكتمل',
          deliveryType:isExpress?'express':'normal',
          shippingMethod:isExpress?'Same Day Delivery':'Standard Delivery',
          note:'', items:'', time:'12:00 م',
          createdAt:new Date().toISOString(),
        };
      }).filter(Boolean);

      const express = parsedExcelOrders.filter(o=>o.deliveryType==='express').length;
      const preview = $('import-preview');
      preview.style.display='block';
      preview.innerHTML=`
        <div style="color:var(--success);font-weight:700;margin-bottom:8px">✅ تم قراءة الملف: <strong>${parsedExcelOrders.length}</strong> طلب</div>
        <div style="color:var(--muted)">⚡ مستعجل: ${express} | 🚚 عادي: ${parsedExcelOrders.length-express}</div>
        <div style="margin-top:8px;max-height:120px;overflow-y:auto;font-size:11px">
          ${parsedExcelOrders.slice(0,5).map(o=>`<div>#${o.id} — ${o.name} — ${o.total} ج (${o.deliveryType==='express'?'⚡':'🚚'})</div>`).join('')}
          ${parsedExcelOrders.length>5?`<div style="color:var(--muted)">... و${parsedExcelOrders.length-5} طلب أخر</div>`:''}
        </div>`;
      $('import-excel-btn').style.display='block';
    }catch(err){
      $('import-preview').style.display='block';
      $('import-preview').innerHTML='<span style="color:var(--danger)">❌ خطأ في قراءة الملف: '+err.message+'</span>';
    }
  };
  reader.readAsArrayBuffer(file);
}

async function doExcelImport(){
  const courierId = +$('import-courier-sel').value;
  if(!courierId){toast('❗ اختر المندوب أولاً');return;}
  const c = couriers.find(x=>x.id==courierId);
  if(!c||!parsedExcelOrders.length){return;}

  let assigned=0, added=0;
  for(const o of parsedExcelOrders){
    const ship = o.deliveryType==='express'?(c.shipExpress||80):(c.ship||50);
    const existing = orders.find(x=>x.id===o.id);
    if(existing){
      existing.courierId=courierId; existing.status='مكتمل'; existing.ship=ship;
      if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{courierId,status:'مكتمل',ship}).catch(()=>{});
      assigned++;
    } else {
      const order={...o, courierId, ship};
      orders.push(order);
      if(API_URL)apiFetch('/api/orders','POST',order).catch(()=>{});
      added++;
    }
  }

  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();
  const msg = `✅ ${c.name}: عيّن ${assigned} + أضاف ${added} طلب`;
  $('import-result').innerHTML=`<span style="color:var(--success)">${msg}</span>`;
  toast(msg);
  pushNotif('📥','استيراد Excel - '+c.name, assigned+' طلب معيّن + '+added+' طلب جديد');
  parsedExcelOrders=[];
  $('import-excel-btn').style.display='none';
}

// ===== PROBLEMS PAGE =====
let currentProbFilter = 'dup';

async function removeProblem(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  o.hasProblem=false;
  if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{hasProblem:false}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();
  toast('✅ تم حل مشكلة الطلب '+id);
}
function clearAllProblems(){
  if(!confirm('هتمسح علامة المشكلة من كل الطلبات؟'))return;
  orders.forEach(o=>{
    if(o.hasProblem){o.hasProblem=false;if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{hasProblem:false}).catch(()=>{});}
  });
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('✅ تم مسح كل المشاكل');
}
function probToggleAll(val){
  document.querySelectorAll('.prob-chk').forEach(c=>c.checked=val);
}

function renderProblemsPage(){
  // حساب badge
  const unassigned = orders.filter(o=>!o.courierId&&o.status!=='ملغي'&&o.status!=='مكتمل');
  const phones = unassigned.map(o=>o.phone).filter(p=>p&&p!=='—');
  const dupPhones = phones.filter((p,i)=>phones.indexOf(p)!==i);
  const dupCount = new Set(dupPhones).size;
  if($('nb-problems')) $('nb-problems').textContent = dupCount||'';
  probFilter(currentProbFilter, document.getElementById('prob-tab-'+currentProbFilter));
}

function probFilter(f, btn){
  currentProbFilter=f;
  document.querySelectorAll('#problems-tabs .chip').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');

  // تحديث عداد المشاكل اليدوية
  const manualCnt=orders.filter(o=>o.hasProblem).length;
  if($('prob-manual-count'))$('prob-manual-count').textContent=manualCnt?'('+manualCnt+')':'';

  const unassigned = orders.filter(o=>!o.courierId&&o.status!=='ملغي'&&o.status!=='مكتمل');
  const cont = $('problems-content');

  if(f==='manual'){
    const problems=orders.filter(o=>o.hasProblem);
    cont.innerHTML=problems.length
      ?`<div class="card">
        <div class="card-hd"><h3>⚠️ طلبات فيها مشكلة (${problems.length})</h3><button class="btn btn-ghost btn-sm" onclick="clearAllProblems()">🗑️ مسح الكل</button></div>
        <div class="tbl-wrap"><table>
        <thead><tr><th style="width:30px"><input type="checkbox" id="prob-chk-all" onchange="probToggleAll(this.checked)"></th>
          <th>رقم الطلب</th><th>النوع</th><th>العميل</th><th>المنطقة</th><th>COD</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>${problems.map(o=>`
          <tr style="background:var(--warn-light)">
            <td style="text-align:center"><input type="checkbox" class="prob-chk" value="${o.id}"></td>
            <td><strong>${o.id}</strong></td>
            <td>${deliveryBadge(o)}</td>
            <td><strong>${o.name}</strong><br><span style="font-size:10px;color:var(--muted);direction:ltr">${o.phone||''}</span></td>
            <td><span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:700">${shortArea(o.area)}</span></td>
            <td><strong>${o.paid?'<span style="color:var(--success)">مدفوع</span>':(o.total.toLocaleString()+' ج')}</strong></td>
            <td>${sBadge(o.status)}</td>
            <td>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-xs" onclick="removeProblem('${o.id}')">✅ حُلت</button>
                ${couriers.map(c=>`<button class="btn btn-xs" style="background:#6366f1;color:#fff;border:none;font-size:10px" onclick="assignOrderId='${o.id}';selCAndConfirm(${c.id})">${c.name}</button>`).join('')}
              </div>
            </td>
          </tr>`).join('')}
        </tbody></table></div></div>`
      :'<div style="text-align:center;padding:40px;color:var(--muted)">✅ لا توجد طلبات مشاكل</div>';
    return;
  }
  currentProbFilter=f;
  document.querySelectorAll('#problems-tabs .chip').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');

  if(f==='dup'){
    // عملاء عندهم أكتر من طلب واحد
    const phoneMap = {};
    unassigned.forEach(o=>{
      const p = (o.phone||'').replace(/\D/g,'');
      if(p&&p!=='') (phoneMap[p]=phoneMap[p]||[]).push(o);
    });
    const dups = Object.values(phoneMap).filter(arr=>arr.length>1);

    if(!dups.length){
      cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">✅ لا يوجد عملاء بطلبات متكررة</div>';
      return;
    }

    cont.innerHTML = dups.map(group=>`
      <div class="card" style="margin-bottom:12px">
        <div class="card-hd" style="background:var(--warn-light)">
          <h3 style="color:#92400e">👥 ${group[0].name} — ${group.length} طلبات | 📱 ${group[0].phone}</h3>
          <span style="font-size:12px;color:#92400e">إجمالي: ${group.reduce((s,o)=>s+o.total,0).toLocaleString()} ج</span>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>رقم الطلب</th><th>النوع</th><th>المنطقة</th><th>العنوان</th><th>COD</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${group.map(o=>`<tr>
              <td><strong>${o.id}</strong><br><span style="font-size:10px;color:var(--muted)">${o.time||''}</span></td>
              <td>${deliveryBadge(o)}</td>
              <td><span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:700">${shortArea(o.area)}</span></td>
              <td style="font-size:11px;color:var(--muted)">${o.addr||o.area}</td>
              <td><strong>${o.paid?'<span style="color:var(--success)">مدفوع</span>':(o.total.toLocaleString()+' ج')}</strong></td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${couriers.map(c=>`<button class="btn btn-xs" style="background:#6366f1;color:#fff;border:none;font-size:10px" onclick="assignOrderId='${o.id}';selCAndConfirm(${c.id})">${c.name}</button>`).join('')}
                  <button class="btn btn-ghost btn-xs" onclick="openAssign('${o.id}')">⋯</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`).join('');

  } else if(f==='noaddr'){
    const noAddr = unassigned.filter(o=>!o.addr||o.addr.length<5||o.addr===o.area);
    cont.innerHTML = noAddr.length
      ? `<div class="card"><div class="tbl-wrap"><table>
          <thead><tr><th>رقم الطلب</th><th>النوع</th><th>العميل</th><th>المنطقة</th><th>COD</th></tr></thead>
          <tbody>${noAddr.map(o=>`<tr>
            <td><strong>${o.id}</strong></td>
            <td>${deliveryBadge(o)}</td>
            <td>${o.name}<br><span style="font-size:10px;direction:ltr;color:var(--muted)">${o.phone}</span></td>
            <td>${o.area}</td>
            <td><strong>${o.total.toLocaleString()} ج</strong></td>
          </tr>`).join('')}</tbody>
        </table></div></div>`
      : '<div style="text-align:center;padding:40px;color:var(--muted)">✅ كل الطلبات فيها عنوان</div>';

  } else if(f==='nophone'){
    const noPhone = unassigned.filter(o=>!o.phone||o.phone==='—'||o.phone.length<8);
    cont.innerHTML = noPhone.length
      ? `<div class="card"><div class="tbl-wrap"><table>
          <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المنطقة</th><th>COD</th></tr></thead>
          <tbody>${noPhone.map(o=>`<tr>
            <td><strong>${o.id}</strong></td>
            <td>${o.name}</td>
            <td>${o.area}</td>
            <td><strong>${o.total.toLocaleString()} ج</strong></td>
          </tr>`).join('')}</tbody>
        </table></div></div>`
      : '<div style="text-align:center;padding:40px;color:var(--muted)">✅ كل الطلبات فيها تليفون</div>';

  } else if(f==='cancelled'){
    const cancelledAssigned = orders.filter(o=>o.status==='ملغي'&&o.courierId);
    cont.innerHTML = cancelledAssigned.length
      ? `<div class="card"><div class="tbl-wrap"><table>
          <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المندوب</th><th>COD</th><th>إجراءات</th></tr></thead>
          <tbody>${cancelledAssigned.map(o=>{
            const c=couriers.find(x=>x.id==o.courierId);
            return`<tr>
              <td><strong>${o.id}</strong></td>
              <td>${o.name}</td>
              <td>${c?c.name:'—'}</td>
              <td>${o.total.toLocaleString()} ج</td>
              <td><button class="btn btn-ghost btn-xs" style="color:var(--warn)" onclick="unassignOrder('${o.id}')">↩️ إلغاء التعيين</button></td>
            </tr>`;}).join('')}
          </tbody></table></div></div>`
      : '<div style="text-align:center;padding:40px;color:var(--muted)">✅ لا توجد طلبات ملغية مع مناديب</div>';
  }
}

// ===== محاسبة المحل =====
let saccPeriod = 'today';

// ===== تسوية محاسبة المحل =====
let shopSettledAt = null;
try{ shopSettledAt = localStorage.getItem('shop_settled_at'); }catch(e){}

function openShopSettle(){
  const list = getSaccOrders().filter(o=>!o.shopSettled);
  const total = list.reduce((s,o)=>s+o.total,0);
  const cod = list.filter(o=>!o.paid);
  const online = list.filter(o=>o.paid);
  const totalCod = cod.reduce((s,o)=>s+o.total,0);
  const totalOnline = online.reduce((s,o)=>s+o.total,0);
  const lastSettle = shopSettledAt ? new Date(shopSettledAt).toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) : 'لم تتم تسوية من قبل';

  $('shop-settle-body').innerHTML = `
    <div style="background:var(--bg);border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:13px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="color:var(--muted)">آخر تسوية:</span> <strong>${lastSettle}</strong></div>
        <div><span style="color:var(--muted)">الفترة:</span> <strong>${{today:'اليوم',week:'هذا الأسبوع',month:'هذا الشهر',all:'الكل'}[saccPeriod]}</strong></div>
        <div><span style="color:var(--muted)">عدد الطلبات:</span> <strong>${list.length} طلب</strong></div>
        <div><span style="color:var(--muted)">إجمالي المبيعات:</span> <strong style="color:var(--accent)">${total.toLocaleString()} ج</strong></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="sc green" style="margin:0"><div class="sc-icon">💵</div><div class="sc-label">COD (${cod.length} طلب)</div><div class="sc-val">${totalCod.toLocaleString()} ج</div></div>
      <div class="sc purple" style="margin:0"><div class="sc-icon">💳</div><div class="sc-label">أونلاين (${online.length} طلب)</div><div class="sc-val">${totalOnline.toLocaleString()} ج</div></div>
    </div>
    <div class="fg">
      <label>ملاحظات التسوية</label>
      <textarea id="shop-settle-note" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px" placeholder="مثال: تم تسليم المبلغ للمحاسب..."></textarea>
    </div>
    <div style="font-size:12px;color:var(--muted)">بعد التسوية: الطلبات دي هتتعلم كمتسواة ومش هتظهر في التسوية الجاية.</div>`;

  openM('m-shop-settle');
}

async function doShopSettle(){
  const list = getSaccOrders().filter(o=>!o.shopSettled);
  if(!list.length){toast('لا توجد طلبات للتسوية');return;}
  const note = $('shop-settle-note')?.value||'';
  const settleDate = new Date().toISOString();

  // علّم الطلبات كمتسواة
  for(const o of list){
    o.shopSettled = true;
    o.shopSettledAt = settleDate;
    if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{shopSettled:true,shopSettledAt:settleDate}).catch(()=>{});
  }

  shopSettledAt = settleDate;
  try{
    localStorage.setItem('shop_settled_at', settleDate);
    localStorage.setItem('orderpro_orders', JSON.stringify(orders));
  }catch(e){}

  closeM('m-shop-settle');
  refreshAll();
  toast('✅ تمت التسوية — '+list.length+' طلب');
  pushNotif('💰','تسوية المحل','تمت تسوية '+list.length+' طلب بإجمالي '+list.reduce((s,o)=>s+o.total,0).toLocaleString()+' ج');
}

function printShopSettle(){
  const list = getSaccOrders().filter(o=>!o.shopSettled);
  const total=list.reduce((s,o)=>s+o.total,0);
  const cod=list.filter(o=>!o.paid).reduce((s,o)=>s+o.total,0);
  const online=list.filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
  const now=new Date();
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <style>body{font-family:Arial;padding:15px;font-size:11px;direction:rtl}
  h2{font-size:14px;margin-bottom:3px}p{color:#666;margin-bottom:10px;font-size:10px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;padding:10px;background:#f8faff;border-radius:6px;border:1px solid #e2e8f0}
  .sum-box{text-align:center}.sum-num{font-size:16px;font-weight:700}.sum-lbl{font-size:9px;color:#666}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{background:#0f172a;color:#fff;padding:5px 6px;text-align:right}
  td{padding:5px 6px;border-bottom:1px solid #e2e8f0}
  tfoot td{background:#eef2ff;font-weight:700}
  @media print{body{padding:5px}}</style></head><body>
  <h2>🏪 تسوية محاسبة المحل</h2>
  <p>${now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${now.toLocaleTimeString('ar-EG')} · ${list.length} طلب</p>
  <div class="summary">
    <div class="sum-box"><div class="sum-num" style="color:#10b981">${total.toLocaleString()} ج</div><div class="sum-lbl">إجمالي</div></div>
    <div class="sum-box"><div class="sum-num" style="color:#f59e0b">${cod.toLocaleString()} ج</div><div class="sum-lbl">COD</div></div>
    <div class="sum-box"><div class="sum-num" style="color:#8b5cf6">${online.toLocaleString()} ج</div><div class="sum-lbl">أونلاين</div></div>
  </div>
  <table><thead><tr><th>#</th><th>رقم الطلب</th><th>العميل</th><th>المنطقة</th><th>الإجمالي</th><th>الدفع</th></tr></thead>
  <tbody>${list.map((o,i)=>`<tr><td>${i+1}</td><td>${o.id}</td><td>${o.name}</td><td>${o.area}</td><td>${o.total.toLocaleString()} ج</td><td>${o.paid?'💳 أونلاين':'💵 COD'}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="4"><strong>الإجمالي</strong></td><td><strong>${total.toLocaleString()} ج</strong></td><td></td></tr></tfoot>
  </table><scr`+'ipt>window.onload=()=>window.print()</scr'+'ipt><\/body><\/html>');
  w.document.close();
}

function saccFilter(p, btn){
  saccPeriod=p;
  document.querySelectorAll('#page-shop-accounting .chip').forEach(b=>b.classList.remove('on'));
  if(btn)btn.classList.add('on');
  renderShopAccounting();
}

function getSaccOrders(){
  const now=new Date();
  const d0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const w0=new Date(d0); w0.setDate(d0.getDate()-d0.getDay());
  const m0=new Date(now.getFullYear(),now.getMonth(),1);
  let list=orders.filter(o=>isPickup(o)&&o.status==='مكتمل');
  if(saccPeriod==='today') list=list.filter(o=>new Date(o.createdAt||0)>=d0);
  else if(saccPeriod==='week') list=list.filter(o=>new Date(o.createdAt||0)>=w0);
  else if(saccPeriod==='month') list=list.filter(o=>new Date(o.createdAt||0)>=m0);
  return list;
}

function renderShopAccounting(){
  const list=getSaccOrders();
  const totalSales=list.reduce((s,o)=>s+o.total,0);
  const cod=list.filter(o=>!o.paid);
  const paid=list.filter(o=>o.paid);
  const totalCod=cod.reduce((s,o)=>s+o.total,0);
  const totalPaid=paid.reduce((s,o)=>s+o.total,0);

  if($('sacc-total'))$('sacc-total').textContent=totalSales.toLocaleString()+' ج';
  if($('sacc-count'))$('sacc-count').textContent=list.length;
  if($('sacc-cod'))$('sacc-cod').textContent=totalCod.toLocaleString()+' ج';
  if($('sacc-paid'))$('sacc-paid').textContent=totalPaid.toLocaleString()+' ج';

  const lbls={today:'اليوم',week:'هذا الأسبوع',month:'هذا الشهر',all:'الكل'};
  if($('sacc-subtitle'))$('sacc-subtitle').textContent=lbls[saccPeriod]+' — '+list.length+' طلب';

  const tbody=$('sacc-tbody');
  if(!tbody)return;
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">لا توجد طلبات مكتملة في هذه الفترة</td></tr>';
    if($('sacc-tfoot'))$('sacc-tfoot').innerHTML='';
    return;
  }
  tbody.innerHTML=list.map(o=>{
    const c=couriers.find(x=>x.id==o.courierId);
    return`<tr style="${o.shopSettled?'opacity:.6;background:#f8faff':''}">
      <td><strong>${o.id}</strong><br><span style="font-size:10px;color:var(--muted)">${o.time||''}</span></td>
      <td>${o.name}<br><span style="font-size:10px;direction:ltr;color:var(--muted)">${o.phone||''}</span></td>
      <td><span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:700">${shortArea(o.area)}</span></td>
      <td><strong>${o.total.toLocaleString()} ج</strong></td>
      <td>${o.paid?'<span style="background:var(--success-light);color:#065f46;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">💳 أونلاين</span>':'<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">💵 COD</span>'}</td>
      <td>${o.shopSettled?'<span style="background:var(--success-light);color:#065f46;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">✅ متسوي</span>':'<span style="background:var(--warn-light);color:#92400e;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">⏳ لم يتسوَّ</span>'}</td>
    </tr>`;
  }).join('');

  if($('sacc-tfoot'))$('sacc-tfoot').innerHTML=`<tr style="background:var(--accent);color:#fff;font-weight:700">
    <td colspan="4" style="padding:10px 12px">الإجمالي — ${list.length} طلب</td>
    <td style="padding:10px 12px">${totalSales.toLocaleString()} ج</td>
    <td style="padding:10px 12px;font-size:11px">💵 ${totalCod.toLocaleString()} | 💳 ${totalPaid.toLocaleString()}</td>
  </tr>`;
}

function printShopAccounting(){
  const list=getSaccOrders();
  if(!list.length){toast('لا توجد طلبات');return;}
  const lbls={today:'اليوم',week:'هذا الأسبوع',month:'هذا الشهر',all:'الكل'};
  const total=list.reduce((s,o)=>s+o.total,0);
  const cod=list.filter(o=>!o.paid).reduce((s,o)=>s+o.total,0);
  const online=list.filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <style>body{font-family:Arial;padding:20px;font-size:12px}
  table{width:100%;border-collapse:collapse}th{background:#0f172a;color:#fff;padding:8px}
  td{padding:8px;border-bottom:1px solid #e2e8f0}
  tfoot td{background:#eef2ff;font-weight:700}
  @media print{body{padding:5px}}</style></head><body>
  <h2 style="margin-bottom:5px">🏪 محاسبة المحل — ${lbls[saccPeriod]}</h2>
  <p style="color:#666;margin-bottom:15px">${new Date().toLocaleDateString('ar-EG')} · ${list.length} طلب</p>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px;padding:12px;background:#f8faff;border-radius:8px">
    <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:#10b981">${total.toLocaleString()} ج</div><div style="font-size:11px;color:#666">إجمالي المبيعات</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:#f59e0b">${cod.toLocaleString()} ج</div><div style="font-size:11px;color:#666">COD</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:#8b5cf6">${online.toLocaleString()} ج</div><div style="font-size:11px;color:#666">أونلاين</div></div>
  </div>
  <table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>المنطقة</th><th>الإجمالي</th><th>الدفع</th></tr></thead>
  <tbody>${list.map(o=>`<tr><td>${o.id}</td><td>${o.name}</td><td>${o.area}</td><td>${o.total.toLocaleString()} ج</td><td>${o.paid?'أونلاين':'COD'}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="3">الإجمالي</td><td>${total.toLocaleString()} ج</td><td>COD: ${cod.toLocaleString()} | أونلاين: ${online.toLocaleString()}</td></tr></tfoot>
  </table><scr`+'ipt>window.onload=()=>window.print()</scr'+'ipt><\/body><\/html>');
  w.document.close();
}

// ===== نظام الشيكات =====
let chkBooks=[];let chkList=[];let chkSuppliers=[];
let editingChkId=null;let chkStatusFilter='all';let chkImgData='';
try{chkSuppliers=JSON.parse(localStorage.getItem('chk_suppliers')||'[]');}catch(e){}
try{chkBooks=JSON.parse(localStorage.getItem('chk_books')||'[]');}catch(e){}
try{chkList=JSON.parse(localStorage.getItem('chk_list')||'[]');}catch(e){}

function saveChks(syncNow=true){
  try{localStorage.setItem('chk_books',JSON.stringify(chkBooks));}catch(e){}
  try{localStorage.setItem('chk_list',JSON.stringify(chkList));}catch(e){}
  try{localStorage.setItem('chk_suppliers',JSON.stringify(chkSuppliers));}catch(e){}
  if(syncNow&&API_URL)apiFetch('/api/sync-checks','POST',{books:chkBooks,checks:chkList}).catch(()=>{});
}
function chkFmtAmount(n){return Number(n||0).toLocaleString('ar-EG');}
function chkFmtDate(d){if(!d)return '—';return new Date(d).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'});}
function chkIsOverdue(c){return c.status==='pending'&&new Date(c.date)<new Date(new Date().toDateString());}
function chkDaysUntil(d){return Math.round((new Date(d)-new Date(new Date().toDateString()))/(864e5));}
function chkGetBadge(c){
  if(c.status==='done')return '<span style="background:var(--success-light);color:#065f46;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">✅ تم صرفه</span>';
  if(chkIsOverdue(c))return '<span style="background:var(--danger-light);color:#991b1b;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">⚠️ متأخر</span>';
  return '<span style="background:var(--warn-light);color:#92400e;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">⏳ لم يُصرف</span>';
}
function chkSetFilter(f,btn){
  chkStatusFilter=f;
  document.querySelectorAll('#chk-status-chips .chip').forEach(c=>c.classList.remove('on'));
  if(btn)btn.classList.add('on');
  if(f==='weekly'){renderWeeklyReport();return;}
  if(f==='suppliers'){renderSuppliersReport();return;}
  renderChecksPage();
}
function renderChecksPage(){
  const now=new Date(new Date().toDateString());
  const weekEnd=new Date(now);weekEnd.setDate(now.getDate()+7);
  const m0=new Date(now.getFullYear(),now.getMonth(),1);
  const m1=new Date(now.getFullYear(),now.getMonth()+1,0);
  const pending=chkList.filter(c=>c.status==='pending');
  const overdue=pending.filter(c=>new Date(c.date)<now);
  const thisWeek=pending.filter(c=>{const d=new Date(c.date);return d>=now&&d<=weekEnd;});
  if($('chk-total-val'))$('chk-total-val').textContent=chkFmtAmount(pending.reduce((s,c)=>s+Number(c.amount),0))+' ج';
  if($('chk-week-val'))$('chk-week-val').textContent=chkFmtAmount(thisWeek.reduce((s,c)=>s+Number(c.amount),0))+' ج';
  if($('chk-overdue-val'))$('chk-overdue-val').textContent=overdue.length;
  if($('chk-done-val'))$('chk-done-val').textContent=chkList.filter(c=>c.status==='done').length;
  if($('nb-checks'))$('nb-checks').textContent=overdue.length||'';

  const period=$('chk-period-filter')?.value||'all';
  const q=($('chk-search')?.value||'').toLowerCase();
  let list=[...chkList];
  if(chkStatusFilter==='pending')list=list.filter(c=>c.status==='pending'&&!chkIsOverdue(c));
  if(chkStatusFilter==='done')list=list.filter(c=>c.status==='done');
  if(chkStatusFilter==='overdue')list=list.filter(c=>chkIsOverdue(c));
  if(period==='week')list=list.filter(c=>{const d=new Date(c.date);return d>=now&&d<=weekEnd;});
  if(period==='month')list=list.filter(c=>{const d=new Date(c.date);return d>=m0&&d<=m1;});
  if(period==='overdue')list=list.filter(c=>chkIsOverdue(c));
  if(q)list=list.filter(c=>(c.num+c.payee+(c.invoice||'')).toLowerCase().includes(q));
  list.sort((a,b)=>new Date(a.date)-new Date(b.date));

  if($('chk-count'))$('chk-count').textContent=list.length+' شيك';
  const tbody=$('chk-tbody');
  if(!tbody)return;
  if(!list.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted)">لا توجد شيكات</td></tr>';$('chk-sum-row').style.display='none';return;}
  tbody.innerHTML=list.map(c=>{
    const days=chkDaysUntil(c.date);
    const dayLbl=c.status==='pending'?(days<0?`<span style="color:var(--danger);font-size:10px">(${Math.abs(days)} يوم تأخير)</span>`:days<=7?`<span style="color:var(--warn);font-size:10px">(بعد ${days} أيام)</span>`:''):'';
    const book=chkBooks.find(b=>b.id===c.bookId);
    return`<tr style="${chkIsOverdue(c)?'background:#fff5f5':''}">
      <td><strong>${c.num}</strong></td>
      <td><strong>${c.payee}</strong>${c.note?`<br><span style="font-size:10px;color:var(--muted)">${c.note}</span>`:''}</td>
      <td style="font-weight:700;font-size:14px">${chkFmtAmount(c.amount)} ج</td>
      <td>${chkFmtDate(c.date)} ${dayLbl}</td>
      <td style="font-size:11px;color:var(--muted)">${book?book.name:'—'}</td>
      <td style="font-size:11px;color:var(--muted)">${c.invoice||'—'}</td>
      <td>${chkGetBadge(c)}</td>
      <td style="text-align:center">${c.img?`<button class="btn btn-ghost btn-xs" onclick="viewChkImg('${c.id}')">🖼️</button>`:'—'}</td>
      <td><div style="display:flex;gap:3px;flex-wrap:wrap">
        ${c.status==='pending'?`<button class="btn btn-xs" style="background:var(--success);color:#fff;border:none" onclick="chkMarkDone('${c.id}')">✅ صُرف</button>`:`<button class="btn btn-ghost btn-xs" onclick="chkMarkPending('${c.id}')">↩️ إلغاء</button>`}
        <button class="btn btn-ghost btn-xs" onclick="openEditChk('${c.id}')">✏️</button>
        <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="deleteChk('${c.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
  const total=list.reduce((s,c)=>s+Number(c.amount),0);
  $('chk-sum-row').textContent=`إجمالي ${list.length} شيك: ${chkFmtAmount(total)} ج`;
  $('chk-sum-row').style.display='block';
}
function calcChkUntil(){
  const d=$('chk-until').value;if(!d)return;
  const until=new Date(d);
  const list=chkList.filter(c=>c.status==='pending'&&new Date(c.date)<=until);
  const total=list.reduce((s,c)=>s+Number(c.amount),0);
  $('chk-until-result').textContent=chkFmtAmount(total)+' ج';
  $('chk-until-count').textContent=list.length+' شيك غير مصروف حتى '+chkFmtDate(d);
}
function openAddChk(){
  editingChkId=null;chkImgData='';
  document.getElementById('chk-modal-title').textContent='شيك جديد';
  ['chk-payee','chk-amount','chk-invoice','chk-note'].forEach(id=>$(id)&&($(id).value=''));
  $('chk-date').value='';
  if($('chk-book-sel'))$('chk-book-sel').value='';
  if($('chk-num-sel'))$('chk-num-sel').innerHTML='<option value="">— اختر الدفتر أولاً —</option>';
  $('chk-img-show').style.display='none';$('chk-img-placeholder').style.display='block';
  $('chk-img-input').value='';
  fillChkBookSel();
  fillSupplierSel();
  // إظهار حقل الكتابة اليدوية
  if($('chk-payee'))$('chk-payee').style.display='block';
  openM('m-chk');
}
function openEditChk(id){
  const c=chkList.find(x=>x.id===id);if(!c)return;
  editingChkId=id;chkImgData=c.img||'';
  document.getElementById('chk-modal-title').textContent='تعديل الشيك';
  $('chk-num').value=c.num||'';$('chk-payee').value=c.payee||'';
  $('chk-amount').value=c.amount||'';$('chk-date').value=c.date||'';
  $('chk-invoice').value=c.invoice||'';$('chk-note').value=c.note||'';
  fillChkBookSel();$('chk-book-sel').value=c.bookId||'';
  if(c.img){$('chk-img-show').src=c.img;$('chk-img-show').style.display='block';$('chk-img-placeholder').style.display='none';}
  else{$('chk-img-show').style.display='none';$('chk-img-placeholder').style.display='block';}
  openM('m-chk');
}
function fillChkBookSel(){
  $('chk-book-sel').innerHTML='<option value="">بدون دفتر</option>'+chkBooks.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
}
function saveChk(){
  const num=($('chk-num-sel')?.value)||($('chk-num')?.value?.trim())||'';
  const payee=($('chk-payee-sel')?.value&&$('chk-payee-sel').value!=='__other__'?$('chk-payee-sel').value:$('chk-payee')?.value?.trim())||'';
  const amount=parseFloat($('chk-amount').value),date=$('chk-date').value;
  if(!num){toast('❗ اختر رقم الشيك');return;}
  if(!payee){toast('❗ اختر المورد أو اكتب الاسم');return;}
  if(!amount||!date){toast('❗ يرجى ملء الحقول المطلوبة');return;}
  const data={id:editingChkId||(Date.now()+'_'+Math.random().toString(36).slice(2,5)),
    num,payee,amount,date,bookId:$('chk-book-sel').value||'',
    invoice:$('chk-invoice').value.trim(),note:$('chk-note').value.trim(),
    img:chkImgData||'',status:editingChkId?(chkList.find(x=>x.id===editingChkId)?.status||'pending'):'pending',
    createdAt:editingChkId?(chkList.find(x=>x.id===editingChkId)?.createdAt||new Date().toISOString()):new Date().toISOString()};
  if(editingChkId){const idx=chkList.findIndex(x=>x.id===editingChkId);if(idx>=0)chkList[idx]=data;}
  else chkList.push(data);
  saveChks(false);if(API_URL)apiFetch('/api/checks','POST',data).catch(()=>{});
  closeM('m-chk');renderChecksPage();toast('✅ تم حفظ الشيك');
}
function chkMarkDone(id){
  const c=chkList.find(x=>x.id===id);if(!c)return;
  c.status='done';c.doneAt=new Date().toISOString();
  saveChks(false);if(API_URL)apiFetch('/api/checks','POST',c).catch(()=>{});
  renderChecksPage();toast('✅ تم تحديد الشيك كمصروف');
}
function chkMarkPending(id){
  const c=chkList.find(x=>x.id===id);if(!c)return;
  c.status='pending';delete c.doneAt;
  saveChks(false);if(API_URL)apiFetch('/api/checks','POST',c).catch(()=>{});
  renderChecksPage();toast('↩️ تم إرجاع الشيك لغير مصروف');
}
function deleteChk(id){
  if(!confirm('هتحذف الشيك ده؟'))return;
  chkList=chkList.filter(x=>x.id!==id);
  saveChks(false);if(API_URL)apiFetch('/api/checks/'+id,'DELETE').catch(()=>{});
  renderChecksPage();toast('🗑️ تم حذف الشيك');
}
function previewChkImg(input){
  if(!input.files[0])return;
  const reader=new FileReader();
  reader.onload=e=>{chkImgData=e.target.result;$('chk-img-show').src=chkImgData;$('chk-img-show').style.display='block';$('chk-img-placeholder').style.display='none';};
  reader.readAsDataURL(input.files[0]);
}
function clearChkImg(){chkImgData='';$('chk-img-show').style.display='none';$('chk-img-placeholder').style.display='block';$('chk-img-input').value='';}
function viewChkImg(id){const c=chkList.find(x=>x.id===id);if(!c||!c.img)return;$('chk-img-full').src=c.img;openM('m-chk-img');}
function openCheckBook(){renderChkBooks();['bk-name','bk-bank','bk-account'].forEach(id=>$(id)&&($(id).value=''));$('bk-pages').value=48;openM('m-chk-books');}
function saveChkBook(){
  const name=$('bk-name').value.trim();if(!name){toast('❗ أدخل اسم الدفتر');return;}
  const b={id:Date.now()+'_bk',name,bank:$('bk-bank').value.trim(),account:$('bk-account').value.trim(),pages:parseInt($('bk-pages').value)||48};
  chkBooks.push(b);saveChks(false);if(API_URL)apiFetch('/api/check-books','POST',b).catch(()=>{});
  renderChkBooks();toast('✅ تم إضافة الدفتر');['bk-name','bk-bank','bk-account'].forEach(id=>$(id)&&($(id).value=''));
}
function renderChkBooks(){
  const el=$('chk-books-list');if(!el)return;
  if(!chkBooks.length){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:12px;font-size:13px">لا توجد دفاتر</div>';return;}
  el.innerHTML=chkBooks.map(b=>{
    const used=chkList.filter(c=>c.bookId===b.id).length,rem=Math.max(0,b.pages-used);
    return`<div style="display:flex;align-items:center;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;font-size:13px">
      <div style="flex:1"><strong>${b.name}</strong>${b.bank?' — '+b.bank:''}</div>
      <div style="text-align:center;min-width:60px"><div style="font-weight:700;color:${rem<5?'var(--danger)':rem<10?'var(--warn)':'var(--success)'}">${rem}</div><div style="font-size:10px;color:var(--muted)">من ${b.pages}</div></div>
      <button class="btn btn-ghost btn-xs" style="color:var(--danger);margin-right:8px" onclick="deleteChkBook('${b.id}')">🗑️</button>
    </div>`;
  }).join('');
}
function deleteChkBook(id){
  if(!confirm('هتحذف الدفتر ده؟'))return;
  chkBooks=chkBooks.filter(x=>x.id!==id);
  saveChks(false);if(API_URL)apiFetch('/api/check-books/'+id,'DELETE').catch(()=>{});
  renderChkBooks();toast('🗑️ تم حذف الدفتر');
}

// ===== تحويل طلب محل لشحن =====
let convertingOrderId=null;

function convertToDelivery(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  convertingOrderId=id;
  const info=$('convert-order-info');
  if(info)info.innerHTML=`<strong>${o.id}</strong> — ${o.name}<br><span style="color:var(--muted);font-size:12px">التحصيل الحالي: <strong>${o.total.toLocaleString()} ج</strong> | ${o.area}</span><br><span style="color:var(--accent);font-size:12px;font-weight:700">التحصيل النهائي = ${o.total.toLocaleString()} + تمن الشحن</span>`;
  $('convert-ship-cost').value=80;
  const list=$('convert-couriers-list');
  if(list){
    list.innerHTML=couriers.map(c=>`<button class="btn btn-sm" style="background:var(--accent);color:#fff;border:none;font-weight:700;margin:2px" onclick="doConvertDelivery(${c.id})">🧑 ${c.name}</button>`).join('')+
      `<button class="btn btn-sm" style="background:#6366f1;color:#fff;border:none;font-weight:700;margin:2px" onclick="doConvertDelivery('bosta')">🚚 بوسطة</button>`;
  }
  openM('m-convert-delivery');
}

async function doConvertDelivery(courierId){
  const o=orders.find(x=>x.id===convertingOrderId);if(!o)return;
  const shipCost=parseFloat($('convert-ship-cost').value)||0;
  const c=courierId!=='bosta'?couriers.find(x=>x.id==courierId):null;
  const baseShip=c?(isSameDay(o)?c.shipExpress||80:c.ship||50):50;
  // التحصيل = الأصلي + تمن الشحن
  o.total=o.total+shipCost;
  o.ship=baseShip;
  o.courierId=courierId;
  o.status='جاري التوصيل';
  o.deliveryType='normal';
  if(API_URL)await apiFetch('/api/orders/'+o.id,'PATCH',{
    courierId,status:'جاري التوصيل',ship:o.ship,total:o.total,deliveryType:'normal'
  }).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  closeM('m-convert-delivery');refreshAll();
  const dest=courierId==='bosta'?'بوسطة':(c?c.name:'مندوب');
  toast(`✅ تم التحويل لـ ${dest} — تحصيل: ${o.total.toLocaleString()} ج (${shipCost} ج شحن)`);
}

async function undoPickup(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  o.status='في الانتظار';
  if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{status:'في الانتظار'}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('↩️ تم رجوع الطلب '+id+' لـ "في الانتظار"');
}

async function unassignBosta(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  o.courierId=null;o.status='جديد';o.bostaId=null;o.bostaTrackingNo=null;o.bostaStatus=null;
  if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{courierId:null,status:'جديد',bostaId:null,bostaTrackingNo:null,bostaStatus:null}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('↩️ تم إلغاء تعيين بوسطة للطلب '+id);
}



// ===== LOGIN SYSTEM =====
const ADMIN_USER = {
  username: 'admin',
  passHash: 'b6623210b82535beb2fe64e288d05a937d29da5d73522814631ca811de9f0ba5',
  role: 'admin',
  name: 'المدير'
};

// قاموس المستخدمين — يُحفظ في localStorage
let sysUsers = [];
try{ sysUsers = JSON.parse(localStorage.getItem('sys_users') || '[]'); }catch(e){}

// المستخدم الحالي
let currentUser = null;
try{ currentUser = JSON.parse(sessionStorage.getItem('current_user') || 'null'); }catch(e){}

function sha256(str){
  // Simple hash using SubtleCrypto async — نستخدم btoa للتبسيط
  // نستخدم implementation محلية بسيطة
  let hash = 0;
  for(let i=0;i<str.length;i++){hash=((hash<<5)-hash)+str.charCodeAt(i);hash|=0;}
  return Math.abs(hash).toString(16).padStart(8,'0');
}

async function hashPass(pass){
  const msgBuffer = new TextEncoder().encode(pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function doLogin(){
  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const err = document.getElementById('login-err');
  
  if(!username||!password){ err.textContent='أدخل اسم المستخدم وكلمة المرور'; return; }
  
  const passHash = await hashPass(password);
  
  // تحقق من الادمن
  let user = null;
  if(username === ADMIN_USER.username && passHash === ADMIN_USER.passHash){
    user = {...ADMIN_USER};
  }
  
  // تحقق من باقي المستخدمين
  if(!user){
    const found = sysUsers.find(u=>u.username===username && u.passHash===passHash && u.active!==false);
    if(found) user = found;
  }
  
  if(!user){ 
    err.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة'; 
    document.getElementById('login-password').value = '';
    return; 
  }
  
  // حفظ الجلسة
  currentUser = user;
  sessionStorage.setItem('current_user', JSON.stringify(user));
  
  // إظهار البرنامج
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-app').style.display = '';
  
  // تطبيق الصلاحيات
  applyPermissions(user.role, user.pages||null);
  
  // تحديث اسم المستخدم في الـ topbar
  const userBadge = document.getElementById('user-badge');
  if(userBadge) userBadge.textContent = '👤 '+user.name;
  
  loadOrders();
  checkExpiryAlerts();
  toast('✅ مرحباً '+user.name);
}

function doLogout(){
  sessionStorage.removeItem('current_user');
  currentUser = null;
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-err').textContent = '';
}

function applyPermissions(role, pages){
  // pages = array of allowed page ids, or null for admin (all)
  // الأدمن دايما عنده كل الصفحات
  if(role==='admin' || !pages){
    document.querySelectorAll('.ni').forEach(ni=>ni.style.display='');
    return;
  }
  // إظهار/إخفاء حسب الصفحات المسموحة
  document.querySelectorAll('.ni').forEach(ni=>{
    const page=ni.dataset.p;
    if(!page) return;
    ni.style.display=pages.includes(page)?'':'none';
  });
}

// ===== إدارة المستخدمين (للأدمن فقط) =====
function renderUsersAdmin(){
  const list=document.getElementById('users-list-admin');
  if(!list) return;
  const allUsers=[{...ADMIN_USER,editable:false},...sysUsers];
  const pageLabels={
    'dashboard':'لوحة التحكم','orders':'الطلبات','couriers':'المناديب',
    'assign':'توزيع الطلبات','pickup':'استلام المحل','transit':'العبور',
    'bosta':'بوسطة','delivery-sheet':'ورقة التوصيل','courier-orders':'طلبات المناديب',
    'import-excel':'استيراد Excel','problems':'مشاكل','accounting':'محاسبة المناديب',
    'shop-accounting':'محاسبة المحل','checks':'الشيكات','reports':'التقارير',
    'expiry':'الصلاحيات','notifs':'الإشعارات','settings':'الإعدادات'
  };
  if(!allUsers.length){list.innerHTML='<div style="color:var(--muted);padding:12px">لا يوجد مستخدمون</div>';return;}
  list.innerHTML=allUsers.map(u=>{
    const isAdmin=u.role==='admin';
    const initials=(u.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('');
    const pagesHtml=isAdmin
      ?'<span style="background:#e8f8f0;color:#3ab877;padding:1px 8px;border-radius:10px;font-size:11px">كل الصفحات</span>'
      :(u.pages||[]).map(p=>`<span style="background:var(--bg);color:var(--muted);padding:1px 7px;border-radius:10px;font-size:10px;border:1px solid var(--border)">${pageLabels[p]||p}</span>`).join(' ');
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${u.editable!==false?'8px':'0'}">
        <div style="width:38px;height:38px;border-radius:50%;background:#3ab877;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${initials}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px">${u.name} <span style="font-size:11px;color:var(--muted);font-weight:400">@${u.username}</span>
            ${u.active===false?'<span style="color:var(--danger);font-size:11px"> ● معطّل</span>':''}
          </div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${pagesHtml}</div>
        </div>
        ${u.editable!==false?`<div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-ghost btn-xs" onclick="openEditUser('${u.username}')">✏️ تعديل</button>
          <button class="btn btn-ghost btn-xs" style="color:${u.active===false?'var(--success)':'var(--danger)'}" onclick="toggleUserActive('${u.username}')">${u.active===false?'✅':'⛔'}</button>
          <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="deleteUser('${u.username}')">🗑️</button>
        </div>`:'<span style="font-size:11px;color:var(--muted)">رئيسي</span>'}
      </div>
    </div>`;
  }).join('');
}

function auSelectAll(checked){
  document.querySelectorAll('[name="au-page"]').forEach(cb=>cb.checked=checked);
}

function openAddUser(){
  editingUsername=null;
  ['au-name','au-username','au-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('add-user-modal-title').textContent='+ مستخدم جديد';
  const hint=document.getElementById('au-pass-hint');
  if(hint)hint.style.display='none';
  // تحديد كل الصفحات بالأساس ما عدا settings
  document.querySelectorAll('[name="au-page"]').forEach(cb=>{
    cb.checked = cb.value !== 'settings';
  });
  openM('m-add-user');
}

let editingUsername = null;
function openEditUser(username){
  const u=sysUsers.find(x=>x.username===username);
  if(!u) return;
  editingUsername=username;
  document.getElementById('au-name').value=u.name||'';
  document.getElementById('au-username').value=u.username||'';
  document.getElementById('au-pass').value='';
  document.getElementById('add-user-modal-title').textContent='✏️ تعديل المستخدم';
  const hint=document.getElementById('au-pass-hint');
  if(hint)hint.style.display='';
  // تحديد الصفحات المسموحة
  const userPages=u.pages||[];
  document.querySelectorAll('[name="au-page"]').forEach(cb=>{
    cb.checked=userPages.includes(cb.value);
  });
  openM('m-add-user');
}

async function saveUser(){
  const name = document.getElementById('au-name')?.value.trim();
  const username = document.getElementById('au-username')?.value.trim().toLowerCase();
  const pass = document.getElementById('au-pass')?.value;
  const role = document.getElementById('au-role')?.value;
  
  if(!name||!username){ toast('❗ أدخل الاسم واسم المستخدم'); return; }
  
  // تحقق من عدم التكرار
  if(!editingUsername && (username==='admin' || sysUsers.find(u=>u.username===username))){
    toast('❗ اسم المستخدم موجود مسبقاً'); return;
  }
  
  let passHash;
  if(pass){
    passHash = await hashPass(pass);
  } else if(editingUsername){
    passHash = sysUsers.find(u=>u.username===editingUsername)?.passHash;
  } else {
    toast('❗ أدخل كلمة المرور'); return;
  }
  
  const userData = {username, name, passHash, role, active: true};
  
  if(editingUsername){
    const idx = sysUsers.findIndex(u=>u.username===editingUsername);
    if(idx>=0) sysUsers[idx] = userData;
  } else {
    sysUsers.push(userData);
  }
  
  localStorage.setItem('sys_users', JSON.stringify(sysUsers));
  closeM('m-add-user');
  renderUsersAdmin();
  toast('✅ تم حفظ المستخدم: '+name);
}

function toggleUserActive(username){
  const u = sysUsers.find(x=>x.username===username);
  if(!u) return;
  u.active = u.active===false ? true : false;
  localStorage.setItem('sys_users', JSON.stringify(sysUsers));
  renderUsersAdmin();
  toast(u.active===false?'⛔ تم تعطيل '+u.name:'✅ تم تفعيل '+u.name);
}

function deleteUser(username){
  if(!confirm('هتحذف المستخدم ده؟')) return;
  sysUsers = sysUsers.filter(u=>u.username!==username);
  localStorage.setItem('sys_users', JSON.stringify(sysUsers));
  renderUsersAdmin();
  toast('🗑️ تم حذف المستخدم');
}

// تشغيل الـ login check
window.addEventListener('load', function(){
  // لو في جلسة محفوظة، ادخل مباشرةً
  if(currentUser){
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').style.display = '';
    applyPermissions(currentUser.role, currentUser.pages||null);
    const userBadge = document.getElementById('user-badge');
    if(userBadge) userBadge.textContent = '👤 '+currentUser.name;
  }
}, {once:true});

// ===== BATCH MODE =====
let batchActive=false,batchOrders=[],batchIndex=0,batchName='',batchResults=[];

function getBatchName(){
  const now=new Date();
  const day=now.toLocaleDateString('ar-EG',{year:'2-digit',month:'2-digit',day:'2-digit'}).replace(/[/]/g,'-');
  const key='batch_day_'+now.toDateString();
  let num=1;
  try{const s=localStorage.getItem(key);num=s?parseInt(s)+1:1;localStorage.setItem(key,num);}catch(e){}
  return day+' — دفعة '+num;
}

function startBatch(){
  const unassigned=orders.filter(o=>!o.courierId&&!o.isBosta&&o.status!=='مكتمل'&&o.status!=='ملغي'&&!isTransit(o));
  if(!unassigned.length){toast('❗ لا توجد طلبات للتوزيع');return;}
  // ترتيب تنازلي برقم الطلب
  batchOrders=[...unassigned].sort((a,b)=>{
    const na=parseInt((a.shopifyId||a.id.replace('SH-','')||0));
    const nb=parseInt((b.shopifyId||b.id.replace('SH-','')||0));
    return nb-na;
  });
  batchIndex=0;batchResults=[];
  batchName=getBatchName();batchActive=true;
  const nb=document.getElementById('batch-name-badge');
  if(nb)nb.textContent='📦 '+batchName;
  renderBatchOrder();
  const ov=document.getElementById('batch-overlay');
  if(ov)ov.classList.add('active');
  document.body.style.overflow='hidden';
}

function renderBatchOrder(){
  if(batchIndex>=batchOrders.length){showBatchSummary();return;}
  const o=batchOrders[batchIndex];
  const total=batchOrders.length;
  const pct=Math.round(batchIndex/total*100);
  const pb=document.getElementById('batch-progress-bar');
  if(pb)pb.style.width=pct+'%';
  const bc=document.getElementById('batch-counter');
  if(bc)bc.textContent=(batchIndex+1)+' من '+total+' ('+pct+'%)';
  const bp=document.getElementById('batch-prev-btn');
  if(bp)bp.style.display=batchIndex>0?'inline-block':'none';
  const isPickupOrder=isPickup(o);
  const pa=document.getElementById('batch-pickup-alert');
  if(pa)pa.style.display=isPickupOrder?'block':'none';
  const pkb=document.getElementById('batch-pickup-btn');
  if(pkb)pkb.style.display=isPickupOrder?'inline-block':'none';
  const typeColor=isSameDay(o)?'#fee2e2':isPickupOrder?'#fef3c7':'#dbeafe';
  const typeText=isSameDay(o)?'⚡ مستعجل':isPickupOrder?'🏪 استلام محل':'🚚 عادي';
  const typeTC=isSameDay(o)?'#991b1b':isPickupOrder?'#92400e':'#1e40af';
  const oid=document.getElementById('batch-order-id');
  if(oid)oid.innerHTML='<span style="font-size:12px;color:var(--muted)">طلب</span> <strong style="font-size:24px;color:var(--accent)">'+o.id+'</strong>';
  const onm=document.getElementById('batch-order-name');
  if(onm)onm.innerHTML='<div style="font-size:20px;font-weight:700;margin:4px 0">'+o.name+'</div>';
  const om=document.getElementById('batch-order-meta');
  if(om)om.innerHTML='<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:'+typeColor+';color:'+typeTC+'">'+typeText+'</span> <span style="padding:4px 10px;border-radius:20px;font-size:12px;background:var(--bg);border:1px solid var(--border)">📍 '+o.area+'</span> <span style="padding:4px 10px;border-radius:20px;font-size:12px;background:var(--bg);border:1px solid var(--border);direction:ltr">'+( o.phone||'—')+'</span>';
  const oad=document.getElementById('batch-order-addr');
  const fullAddr=(o.addr||o.area||'').replace(/\n/g,' ');
  if(oad)oad.innerHTML='<div style="font-size:15px;color:#1e293b;font-weight:500;padding:10px 14px;background:#fff;border-radius:10px;border:2px solid #e2e8f0;margin-top:8px;line-height:1.6">📍 '+fullAddr+'</div>';
  const oam=document.getElementById('batch-order-amount');
  if(oam)oam.innerHTML=o.paid?'<div style="font-size:20px;font-weight:700;color:var(--success);margin-top:8px">💳 مدفوع أونلاين</div>':'<div style="font-size:20px;font-weight:700;color:var(--warn);margin-top:8px">💵 تحصيل: <span style="font-size:26px;color:var(--text)">'+o.total.toLocaleString()+' ج</span></div>';
  const hint=document.getElementById('batch-hint');
  if(hint)hint.textContent=isPickupOrder?'استلم من المحل أو وزّع على مندوب':'اختر مندوباً للتوزيع';
  const grid=document.getElementById('batch-couriers-grid');
  if(grid){
    const ranked=couriers.map(c=>({...c,zm:zoneMatchScore(o.area,c.zone)})).sort((a,b)=>(b.zm-a.zm));
    grid.innerHTML=ranked.map(c=>{
      const ship=isSameDay(o)?(c.shipExpress||80):(c.ship||50);
      const star=c.zm===2?'⭐ ':'';
      const extra=!isPickupOrder?('<br><span style="font-size:10px;opacity:.7">'+ship+' ج</span>'):'';
      const bc2=c.zm===2?'#10b981':c.zm===1?'#f59e0b':'var(--border)';
      const bg2=c.zm===2?'#ecfdf5':c.zm===1?'#fffbeb':'#fff';
      return '<button onclick="batchAssign('+c.id+')" style="padding:10px 12px;border-radius:10px;border:2px solid '+bc2+';background:'+bg2+';font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;text-align:center">'+star+c.name+extra+'</button>';
    }).join('')+'<button onclick="batchAssign(0)" style="padding:10px 12px;border-radius:10px;border:2px solid #6366f1;background:#fff;color:#6366f1;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer">🚚 بوسطة</button>';
  }
}

async function batchAssign(courierId){
  const o=batchOrders[batchIndex];
  if(courierId===0)courierId='bosta';
  const c=courierId!=='bosta'?couriers.find(x=>x.id==courierId):null;
  const ship=c?(isSameDay(o)?c.shipExpress||80:c.ship||50):50;
  const assignedZone=getOrderZoneForCourier(o,c||{zone:''});
  const isBosta=courierId==='bosta';
  const upd=isBosta
    ?{courierId:null,isBosta:true,ship,status:'جاري التوصيل',assignedZone}
    :{courierId,isBosta:false,ship,status:'جاري التوصيل',assignedZone};
  Object.assign(o,upd);
  if(c)c.status='نشط';
  if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',upd).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  batchResults.push({orderId:o.id,name:o.name,courierId,courierName:c?c.name:'بوسطة',action:'assigned'});
  batchIndex++;renderBatchOrder();
}

async function batchMarkPickup(){
  const o=batchOrders[batchIndex];
  o.status='مكتمل';
  if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{status:'مكتمل'}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  batchResults.push({orderId:o.id,name:o.name,action:'pickup'});
  batchIndex++;renderBatchOrder();
}

function batchSkip(){
  batchResults.push({orderId:batchOrders[batchIndex].id,name:batchOrders[batchIndex].name,action:'skipped'});
  batchIndex++;renderBatchOrder();
}

function batchPrev(){
  if(batchIndex<=0)return;
  const last=batchResults.pop();
  if(last&&last.action==='assigned'){
    const o=orders.find(x=>x.id===last.orderId);
    if(o){o.courierId=null;o.status='جديد';if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{courierId:null,status:'جديد'}).catch(()=>{});}
  } else if(last&&last.action==='pickup'){
    const o=orders.find(x=>x.id===last.orderId);
    if(o){o.status='في الانتظار';if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{status:'في الانتظار'}).catch(()=>{});}
  }
  batchIndex--;renderBatchOrder();
}

function showBatchSummary(){
  const ov=document.getElementById('batch-overlay');
  if(!ov)return;
  const assigned=batchResults.filter(r=>r.action==='assigned');
  const pickups=batchResults.filter(r=>r.action==='pickup');
  const skipped=batchResults.filter(r=>r.action==='skipped');
  const byCourier={};
  assigned.forEach(r=>{if(!byCourier[r.courierName])byCourier[r.courierName]=[];byCourier[r.courierName].push(r.name);});
  ov.innerHTML='<div style="background:#fff;border-radius:20px;width:min(640px,96vw);max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,.4)">'
    +'<div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
    +'<div><div style="font-size:18px;font-weight:700">✅ انتهت الدفعة</div><div style="font-size:13px;color:var(--muted);margin-top:3px">'+batchName+'</div></div>'
    +'<button onclick="endBatch()" style="background:var(--accent);color:#fff;border:none;border-radius:9px;padding:10px 20px;font-family:Cairo,sans-serif;font-weight:700;font-size:14px;cursor:pointer">✓ حفظ وإغلاق</button>'
    +'</div><div style="padding:20px">'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'
    +'<div style="background:var(--success-light);border-radius:10px;padding:12px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--success)">'+assigned.length+'</div><div style="font-size:12px;color:#065f46">✅ وُزّع</div></div>'
    +'<div style="background:var(--warn-light);border-radius:10px;padding:12px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--warn)">'+pickups.length+'</div><div style="font-size:12px;color:#92400e">🏪 استُلم</div></div>'
    +'<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)"><div style="font-size:28px;font-weight:700;color:var(--muted)">'+skipped.length+'</div><div style="font-size:12px;color:var(--muted)">⏭ تخطي</div></div>'
    +'</div>'
    +Object.entries(byCourier).map(([name,ords])=>'<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px"><div style="font-weight:700;margin-bottom:6px">🧑 '+name+' — '+ords.length+' طلب</div><div style="font-size:12px;color:var(--muted)">'+ords.join(' · ')+'</div></div>').join('')
    +(pickups.length?'<div style="border:1px solid #fde68a;border-radius:10px;padding:12px;background:var(--warn-light);margin-bottom:8px"><div style="font-weight:700;margin-bottom:6px">🏪 المحل — '+pickups.length+' طلب</div><div style="font-size:12px;color:#92400e">'+pickups.map(r=>r.name).join(' · ')+'</div></div>':'')
    +(skipped.length?'<div style="border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-weight:700;color:var(--muted);margin-bottom:6px">⏭ متخطي — '+skipped.length+' طلب</div><div style="font-size:12px;color:var(--muted)">'+skipped.map(r=>r.name).join(' · ')+'</div></div>':'')
    +'</div></div>';
}

function minimizeBatch(){
  // تصغير الدفعة - الخروج بدون إنهاء
  const ov=document.getElementById('batch-overlay');
  if(ov)ov.classList.remove('active');
  document.body.style.overflow='';
  // إظهار زرار الاستكمال
  const fl=document.getElementById('batch-resume-float');
  if(fl){
    fl.style.display='flex';
    const remaining=batchOrders.length-batchIndex;
    const ft=document.getElementById('batch-float-text');
    if(ft)ft.textContent='📦 استكمال الدفعة ('+remaining+' طلب متبقي)';
  }
  // تحديث أزرار صفحة التوزيع
  const sb=document.getElementById('btn-start-batch');
  const rb=document.getElementById('btn-resume-batch');
  const eb=document.getElementById('btn-end-batch');
  if(sb)sb.style.display='none';
  if(rb)rb.style.display='inline-block';
  if(eb)eb.style.display='inline-block';
  refreshAll();
  toast('↙ تم تصغير الدفعة — اضغط استكمال للرجوع');
}

function resumeBatch(){
  // استئناف الدفعة
  const fl=document.getElementById('batch-resume-float');
  if(fl)fl.style.display='none';
  // إخفاء أزرار استكمال/إنهاء في صفحة التوزيع
  const rb3=document.getElementById('btn-resume-batch');
  const eb3=document.getElementById('btn-end-batch');
  if(rb3)rb3.style.display='none';
  if(eb3)eb3.style.display='none';
  renderBatchOrder();
  const ov=document.getElementById('batch-overlay');
  if(ov)ov.classList.add('active');
  document.body.style.overflow='hidden';
}

function endBatch(){
  batchActive=false;batchOrders=[];batchIndex=0;batchResults=[];
  const ov=document.getElementById('batch-overlay');
  if(ov)ov.classList.remove('active');
  // إخفاء الـ float button
  const fl=document.getElementById('batch-resume-float');
  if(fl)fl.style.display='none';
  // إخفاء أزرار استكمال/إنهاء في صفحة التوزيع
  const rb3=document.getElementById('btn-resume-batch');
  const eb3=document.getElementById('btn-end-batch');
  if(rb3)rb3.style.display='none';
  if(eb3)eb3.style.display='none';
  document.body.style.overflow='';
  // رجوع أزرار التوزيع للوضع الطبيعي
  const sb2=document.getElementById('btn-start-batch');
  const rb2=document.getElementById('btn-resume-batch');
  const eb2=document.getElementById('btn-end-batch');
  if(sb2)sb2.style.display='inline-block';
  if(rb2)rb2.style.display='none';
  if(eb2)eb2.style.display='none';
  refreshAll();
  toast('✅ تم إنهاء الدفعة: '+batchName);
}

// ===== تعديل منطقة الطلب =====
let editingZoneOrderId=null, editingZoneCId=null;

function openZoneEdit(orderId, cId){
  const o=orders.find(x=>x.id===orderId);
  const c=couriers.find(x=>x.id==cId);
  if(!o)return;
  editingZoneOrderId=orderId; editingZoneCId=cId;

  const info=document.getElementById('zone-edit-order-info');
  if(info)info.innerHTML='<strong>'+orderId+'</strong> — '+o.name+'<br><span style="color:var(--muted);font-size:11px">المنطقة الحالية: <strong>'+(o.assignedZone||'أخري')+'</strong> | منطقة الطلب: '+o.area+'</span>';

  const input=document.getElementById('zone-edit-input');
  // لو مش موجودة احسبها تلقائياً
  if(!o.assignedZone && c) o.assignedZone = getOrderZoneForCourier(o, c);
  if(input){
    input.value=''; // فاضي — الاختيار بيتم من الـ chips
    input.placeholder='اكتب منطقة يدوياً أو اختر من الأزرار...';
    input.oninput=function(){
      // لو كتب يدوي، أشيل highlight عن الـ chips
      const chips=document.getElementById('zone-edit-chips');
      if(chips)chips.querySelectorAll('.chip').forEach(b=>b.classList.remove('on'));
    };
  }

  // مناطق المندوب كـ chips
  const chips=document.getElementById('zone-edit-chips');
  if(chips){
    const zones=c?(c.zone||'').split(/[،,\/\-–\n]+/).map(z=>z.trim()).filter(z=>z.length>1):[];
    const allZones=['أخري',...zones];
    const current=o.assignedZone||'أخري';

    chips.innerHTML=allZones.map(z=>{
      const isActive=z===current;
      const cls=isActive?'chip on':'chip';
      return '<button class="'+cls+'" onclick="selectZoneChip(this,this.textContent.trim())" style="font-size:12px;padding:5px 12px">'+z+'</button>';
    }).join('');
  }
  openM('m-zone-edit');
}

function selectZoneChip(btn, zone){
  const chips=document.getElementById('zone-edit-chips');
  if(chips)chips.querySelectorAll('.chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const input=document.getElementById('zone-edit-input');
  if(input)input.value=zone;
}

async function saveZoneEdit(){
  const o=orders.find(x=>x.id===editingZoneOrderId);
  if(!o)return;
  // اختيار من الـ chips أو من الـ input
  const inputVal=document.getElementById('zone-edit-input')?.value.trim();
  const activeChip=document.querySelector('#zone-edit-chips .chip.on');
  const newZone=inputVal||( activeChip?activeChip.textContent.trim():'')||'أخري';
  o.assignedZone=newZone;
  if(API_URL)apiFetch('/api/orders/'+o.id,'PATCH',{assignedZone:newZone}).catch(()=>{});
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  closeM('m-zone-edit');
  const lbl=document.getElementById('zone-label-'+o.id);
  if(lbl)lbl.textContent=newZone;
  toast('✅ تم تحديث المنطقة إلى: '+newZone);
}

// ===== دوال الشيكات الجديدة =====

// حساب آخر رقم شيك تلقائياً
document.addEventListener('input', function(e){
  if(e.target.id==='bk-first-num'||e.target.id==='bk-pages'){
    const first=parseInt($('bk-first-num')?.value)||0;
    const pages=parseInt($('bk-pages')?.value)||48;
    if($('bk-last-num')&&first>0) $('bk-last-num').value=first+pages-1;
  }
});

// لما يتغير الدفتر → حدّث قائمة أرقام الشيكات
function onChkBookChange(){
  const sel=$('chk-book-sel');
  const numSel=$('chk-num-sel');
  if(!sel||!numSel)return;
  const bookId=sel.value;
  const book=chkBooks.find(b=>b.id===bookId);
  if(!book||!book.firstNum){
    numSel.innerHTML='<option value="">— لا توجد أرقام (أضف رقم أول شيك للدفتر) —</option>';
    return;
  }
  const first=book.firstNum||1;
  const pages=book.pages||48;
  const used=chkList.filter(c=>c.bookId===bookId).map(c=>String(c.num));
  const opts=[];
  for(let i=0;i<pages;i++){
    const num=String(first+i);
    if(!used.includes(num)){
      opts.push(`<option value="${num}">${num}</option>`);
    }
  }
  if(!opts.length){
    numSel.innerHTML='<option value="">— الدفتر ممتلئ —</option>';
  } else {
    numSel.innerHTML='<option value="">— اختر رقم الشيك —</option>'+opts.join('');
  }
}

// لما يتغير المورد من القائمة
function onChkPayeeChange(){
  const sel=$('chk-payee-sel');
  const input=$('chk-payee');
  if(sel&&input&&sel.value){
    input.value=sel.value;
    input.style.display='none';
  } else if(input){
    input.style.display='block';
  }
}

// إضافة مورد جديد
function openAddSupplier(){
  if($('supplier-name-input'))$('supplier-name-input').value='';
  if($('supplier-note-input'))$('supplier-note-input').value='';
  openM('m-add-supplier');
}

function saveSupplier(){
  const name=$('supplier-name-input')?.value.trim();
  if(!name){toast('❗ أدخل اسم المورد');return;}
  if(chkSuppliers.find(s=>s.name===name)){toast('⚠️ المورد موجود مسبقاً');return;}
  chkSuppliers.push({id:Date.now()+'_sup',name,note:$('supplier-note-input')?.value.trim()||''});
  saveChks(false);
  closeM('m-add-supplier');
  fillSupplierSel();
  toast('✅ تم إضافة المورد: '+name);
}

function fillSupplierSel(){
  const sel=$('chk-payee-sel');
  if(!sel)return;
  sel.innerHTML='<option value="">— اختر المورد —</option>'+
    chkSuppliers.map(s=>`<option value="${s.name}">${s.name}</option>`).join('')+
    '<option value="__other__">أخرى (اكتب يدوياً)</option>';
}

// ===== تقرير أسبوعي =====
function renderWeeklyReport(){
  const container=$('chk-tbody');
  if(!container)return;

  const now=new Date();
  const year=now.getFullYear();

  // حساب كل أسابيع السنة (52 أسبوع)
  const weeks=[];
  for(let w=1;w<=52;w++){
    // أول يوم في الأسبوع w من السنة
    const start=new Date(year,0,1+(w-1)*7);
    // تعديل للـ Sunday
    start.setDate(start.getDate()-start.getDay()+1);
    const end=new Date(start);
    end.setDate(start.getDate()+6);
    // الشيكات المستحقة في هذا الأسبوع
    const weekChecks=chkList.filter(c=>{
      const d=new Date(c.date);
      return d>=start&&d<=end;
    });
    const total=weekChecks.reduce((s,c)=>s+Number(c.amount),0);
    const pending=weekChecks.filter(c=>c.status==='pending');
    const done=weekChecks.filter(c=>c.status==='done');
    weeks.push({w,start,end,checks:weekChecks,total,pending,done});
  }

  // عرض التقرير
  const sumRow=$('chk-sum-row');
  if(sumRow)sumRow.style.display='none';

  // تحديث الـ thead
  const thead=container.closest('table')?.querySelector('thead tr');
  if(thead){
    thead.innerHTML=`
      <th>الأسبوع</th>
      <th>من</th>
      <th>إلى</th>
      <th>عدد الشيكات</th>
      <th>إجمالي المستحق</th>
      <th>مصروف</th>
      <th>لم يُصرف</th>`;
  }

  const activeWeeks=weeks.filter(w=>w.checks.length>0);
  if(!activeWeeks.length){
    container.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted)">لا توجد شيكات مسجلة لهذا العام</td></tr>`;
    return;
  }

  // حساب التقرير الشهري
  const months={};
  for(let m=1;m<=12;m++) months[m]={checks:[],total:0};
  chkList.forEach(c=>{
    const m=new Date(c.date).getMonth()+1;
    if(months[m]){months[m].checks.push(c);months[m].total+=Number(c.amount);}
  });

  const monthNames=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  container.innerHTML=
    // إحصائيات الأشهر أولاً
    `<tr><td colspan="7" style="padding:10px;background:var(--accent-light);font-weight:700;color:var(--accent);font-size:13px">📆 ملخص شهري — ${year}</td></tr>`+
    Object.entries(months).filter(([m,d])=>d.checks.length>0).map(([m,d])=>{
      const pending=d.checks.filter(c=>c.status==='pending').reduce((s,c)=>s+Number(c.amount),0);
      const done=d.checks.filter(c=>c.status==='done').reduce((s,c)=>s+Number(c.amount),0);
      return`<tr style="background:#f8faff">
        <td colspan="3" style="font-weight:700;color:var(--accent)">${monthNames[m-1]}</td>
        <td>${d.checks.length} شيك</td>
        <td style="font-weight:700">${d.total.toLocaleString()} ج</td>
        <td style="color:var(--success)">${done.toLocaleString()} ج</td>
        <td style="color:var(--warn)">${pending.toLocaleString()} ج</td>
      </tr>`;
    }).join('')+
    // فاصل
    `<tr><td colspan="7" style="padding:10px;background:var(--accent-light);font-weight:700;color:var(--accent);font-size:13px">📅 تفاصيل أسبوعية — ${year}</td></tr>`+
    weeks.map(w=>{
      const isNow=new Date()>=w.start&&new Date()<=w.end;
      const hasPast=w.end<new Date();
      const bg=isNow?'#fff8e1':hasPast&&w.pending.length>0?'#fff5f5':'';
      const pendingAmt=w.pending.reduce((s,c)=>s+Number(c.amount),0);
      const doneAmt=w.done.reduce((s,c)=>s+Number(c.amount),0);
      return`<tr style="background:${bg}">
        <td><strong style="color:${isNow?'var(--warn)':'var(--text)'}">أسبوع ${w.w}${isNow?' ◀ الآن':''}</strong></td>
        <td style="font-size:11px">${w.start.toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</td>
        <td style="font-size:11px">${w.end.toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</td>
        <td>${w.checks.length||'—'}</td>
        <td style="font-weight:${w.total>0?'700':'400'};color:${w.total>0?'var(--text)':'var(--muted)'}">${w.total>0?w.total.toLocaleString()+' ج':'—'}</td>
        <td style="color:var(--success)">${doneAmt>0?doneAmt.toLocaleString()+' ج':'—'}</td>
        <td style="color:${pendingAmt>0?'var(--warn)':'var(--muted)'}">${pendingAmt>0?pendingAmt.toLocaleString()+' ج':'—'}</td>
      </tr>`;
    }).join('');
}

// ===== تقرير الموردين =====
function renderSuppliersReport(){
  const container=$('chk-tbody');
  if(!container)return;

  const sumRow=$('chk-sum-row');
  if(sumRow)sumRow.style.display='none';

  const thead=container.closest('table')?.querySelector('thead tr');
  if(thead){
    thead.innerHTML=`
      <th>المورد</th>
      <th>إجمالي الشيكات</th>
      <th>لم يُصرف</th>
      <th>تم صرفه</th>
      <th>متأخر</th>
      <th>آخر شيك</th>
      <th>تفاصيل</th>`;
  }

  // تجميع الشيكات حسب المورد
  const supplierMap={};
  chkList.forEach(c=>{
    const key=c.payee||'غير محدد';
    if(!supplierMap[key])supplierMap[key]={name:key,checks:[],total:0,pending:0,done:0,overdue:0,lastDate:''};
    supplierMap[key].checks.push(c);
    supplierMap[key].total+=Number(c.amount);
    if(c.status==='done')supplierMap[key].done+=Number(c.amount);
    else if(chkIsOverdue(c))supplierMap[key].overdue+=Number(c.amount);
    else supplierMap[key].pending+=Number(c.amount);
    if(!supplierMap[key].lastDate||c.date>supplierMap[key].lastDate)supplierMap[key].lastDate=c.date;
  });

  const suppliers=Object.values(supplierMap).sort((a,b)=>b.total-a.total);

  if(!suppliers.length){
    container.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted)">لا توجد شيكات</td></tr>`;
    return;
  }

  container.innerHTML=suppliers.map(s=>`<tr>
    <td><strong>${s.name}</strong></td>
    <td>${s.checks.length} شيك<br><span style="font-size:11px;font-weight:700">${s.total.toLocaleString()} ج</span></td>
    <td style="color:var(--warn)">${s.pending>0?s.pending.toLocaleString()+' ج':'—'}</td>
    <td style="color:var(--success)">${s.done>0?s.done.toLocaleString()+' ج':'—'}</td>
    <td style="color:var(--danger)">${s.overdue>0?s.overdue.toLocaleString()+' ج':'—'}</td>
    <td style="font-size:11px">${chkFmtDate(s.lastDate)}</td>
    <td>
      <button class="btn btn-ghost btn-xs" onclick="showSupplierDetails(this.dataset.name)" data-name="${s.name}">📋 تفاصيل</button>
    </td>
  </tr>`).join('');
}

function showSupplierDetails(supplierName){
  const checks=chkList.filter(c=>c.payee===supplierName);
  const total=checks.reduce((s,c)=>s+Number(c.amount),0);
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <style>body{font-family:Roboto,Arial,sans-serif;padding:20px;font-size:12px;direction:rtl}
  h2{font-size:16px;margin-bottom:4px}p{color:#666;font-size:11px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}th{background:#000;color:#fff;padding:7px 10px;text-align:right;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #eee;font-size:11px}
  tfoot td{background:#e8f8f0;font-weight:700;color:#3ab877}
  @media print{body{padding:5px}}</style></head><body>
  <h2>🏢 تقرير المورد: ${supplierName}</h2>
  <p>إجمالي ${checks.length} شيك | ${total.toLocaleString()} ج</p>
  <table><thead><tr><th>رقم الشيك</th><th>القيمة</th><th>الاستحقاق</th><th>الدفتر</th><th>الفاتورة</th><th>الحالة</th></tr></thead>
  <tbody>${checks.map(c=>{
    const book=chkBooks.find(b=>b.id===c.bookId);
    const st=c.status==='done'?'✅ صُرف':chkIsOverdue(c)?'⚠️ متأخر':'⏳ لم يُصرف';
    return`<tr><td>${c.num}</td><td>${Number(c.amount).toLocaleString()} ج</td><td>${chkFmtDate(c.date)}</td><td>${book?book.name:'—'}</td><td>${c.invoice||'—'}</td><td>${st}</td></tr>`;
  }).join('')}</tbody>
  <tfoot><tr><td colspan="5">الإجمالي</td><td>${total.toLocaleString()} ج</td></tr></tfoot>
  </table><scr`+'ipt>window.onload=()=>window.print()</sc'+'ript></body></html>');
  w.document.close();
}

// ===== نظام الصلاحيات =====
let expiryList = [];
let expiryFilter = 'all';
let editingExpiryId = null;
let expSettings = {alertDays: 30};

// تحميل البيانات
try{ expiryList = JSON.parse(localStorage.getItem('expiry_list')||'[]'); }catch(e){}
try{ expSettings = JSON.parse(localStorage.getItem('expiry_settings')||'{"alertDays":30}'); }catch(e){}

function saveExpiryData(){
  try{localStorage.setItem('expiry_list',JSON.stringify(expiryList));}catch(e){}
  if(API_URL) apiFetch('/api/expiry','POST',{items:expiryList}).catch(()=>{});
}

function saveExpSettings(){
  const days = parseInt($('exp-alert-days')?.value)||30;
  expSettings.alertDays = days;
  try{localStorage.setItem('expiry_settings',JSON.stringify(expSettings));}catch(e){}
  renderExpiryPage();
}

function expDaysLeft(dateStr){
  if(!dateStr) return null;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / 864e5);
}

function expGetStatus(daysLeft){
  if(daysLeft === null) return 'unknown';
  if(daysLeft < 0) return 'expired';
  if(daysLeft <= 30) return 'soon';
  if(daysLeft <= 90) return 'ok';
  return 'safe';
}

function expStatusBadge(daysLeft){
  const st = expGetStatus(daysLeft);
  if(st==='expired') return '<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">🔴 منتهية</span>';
  if(st==='soon')    return '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">🟡 قريباً</span>';
  if(st==='ok')      return '<span style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">🔵 90 يوم</span>';
  return '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ آمن</span>';
}

function expSetFilter(f, btn){
  expiryFilter = f;
  document.querySelectorAll('#exp-filter-chips .chip').forEach(c=>c.classList.remove('on'));
  if(btn) btn.classList.add('on');
  renderExpiryPage();
}

function renderExpiryPage(){
  const alertDays = expSettings.alertDays || 30;
  if($('exp-alert-days')) $('exp-alert-days').value = alertDays;

  // stats
  const expired = expiryList.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='expired');
  const soon    = expiryList.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='soon');
  const ok      = expiryList.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='ok');
  if($('exp-stat-expired')) $('exp-stat-expired').textContent = expired.length;
  if($('exp-stat-soon'))    $('exp-stat-soon').textContent    = soon.length;
  if($('exp-stat-ok'))      $('exp-stat-ok').textContent      = ok.length;
  if($('exp-stat-total'))   $('exp-stat-total').textContent   = expiryList.length;

  // badge في الـ nav
  const alertCount = expired.length + soon.length;
  if($('nb-expiry')) $('nb-expiry').textContent = alertCount || '';

  // فلترة
  const q = ($('exp-search')?.value||'').toLowerCase();
  let list = [...expiryList];

  if(expiryFilter==='expired') list = list.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='expired');
  else if(expiryFilter==='soon') list = list.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='soon');
  else if(expiryFilter==='ok')   list = list.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='ok');
  else if(expiryFilter==='safe') list = list.filter(p=>expGetStatus(expDaysLeft(p.expDate))==='safe');

  if(q) list = list.filter(p=>(p.name+p.sku+p.category).toLowerCase().includes(q));

  // ترتيب: الأقرب انتهاءً أولاً
  list.sort((a,b)=>new Date(a.expDate)-new Date(b.expDate));

  if($('exp-count')) $('exp-count').textContent = list.length + ' منتج';

  const tbody = $('exp-tbody');
  if(!tbody) return;

  if(!list.length){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">لا توجد منتجات' + (q?' تطابق البحث':'') + '</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p=>{
    const days = expDaysLeft(p.expDate);
    const daysText = days===null?'—':days<0?'منذ '+(Math.abs(days))+' يوم':days===0?'اليوم!':days+' يوم';
    const daysColor = days===null?'var(--muted)':days<0?'var(--danger)':days<=30?'var(--warn)':days<=90?'var(--info)':'var(--success)';
    const rowBg = days!==null&&days<0?'#fff5f5':days!==null&&days<=30?'#fffbeb':'';
    return `<tr style="background:${rowBg}">
      <td style="text-align:center"><input type="checkbox" class="exp-chk" value="${p.id}"></td>
      <td>
        <strong>${p.name}</strong>
        ${p.category?`<br><span style="font-size:10px;color:var(--muted);background:var(--bg);padding:1px 7px;border-radius:10px">${p.category}</span>`:''}
        ${p.note?`<br><span style="font-size:10px;color:var(--muted)">${p.note}</span>`:''}
      </td>
      <td style="font-size:11px;color:var(--muted);direction:ltr">${p.sku||'—'}</td>
      <td style="font-weight:700;text-align:center">${p.qty||1}</td>
      <td style="font-weight:600">${p.expDate?new Date(p.expDate).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}):' —'}</td>
      <td style="font-weight:700;color:${daysColor};text-align:center">${daysText}</td>
      <td>${expStatusBadge(days)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-xs" onclick="openEditExpiry('${p.id}')">✏️</button>
          <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="deleteExpiry('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddExpiry(){
  editingExpiryId = null;
  if(document.getElementById('exp-modal-title')) document.getElementById('exp-modal-title').textContent = '➕ إضافة منتج';
  ['exp-name','exp-sku','exp-category','exp-note'].forEach(id=>$(id)&&($(id).value=''));
  if($('exp-qty')) $('exp-qty').value = 1;
  if($('exp-date')) $('exp-date').value = '';
  openM('m-expiry');
}

function openEditExpiry(id){
  const p = expiryList.find(x=>x.id===id);
  if(!p) return;
  editingExpiryId = id;
  if(document.getElementById('exp-modal-title')) document.getElementById('exp-modal-title').textContent = '✏️ تعديل المنتج';
  if($('exp-name'))     $('exp-name').value     = p.name||'';
  if($('exp-sku'))      $('exp-sku').value       = p.sku||'';
  if($('exp-qty'))      $('exp-qty').value       = p.qty||1;
  if($('exp-date'))     $('exp-date').value      = p.expDate||'';
  if($('exp-category')) $('exp-category').value  = p.category||'';
  if($('exp-note'))     $('exp-note').value      = p.note||'';
  openM('m-expiry');
}

function saveExpiry(){
  const name = $('exp-name')?.value.trim();
  const date = $('exp-date')?.value;
  if(!name) { toast('❗ أدخل اسم المنتج'); return; }
  if(!date) { toast('❗ أدخل تاريخ الانتهاء'); return; }

  const data = {
    id: editingExpiryId || (Date.now()+'_exp'),
    name, sku: $('exp-sku')?.value.trim()||'',
    qty: parseInt($('exp-qty')?.value)||1,
    expDate: date,
    category: $('exp-category')?.value.trim()||'',
    note: $('exp-note')?.value.trim()||'',
    addedAt: editingExpiryId ? (expiryList.find(x=>x.id===editingExpiryId)?.addedAt||new Date().toISOString()) : new Date().toISOString()
  };

  if(editingExpiryId){
    const idx = expiryList.findIndex(x=>x.id===editingExpiryId);
    if(idx>=0) expiryList[idx] = data;
  } else {
    expiryList.push(data);
  }

  saveExpiryData();
  closeM('m-expiry');
  renderExpiryPage();
  toast('✅ تم حفظ: '+name);
}

function deleteExpiry(id){
  const p = expiryList.find(x=>x.id===id);
  if(!p || !confirm('هتحذف "'+p.name+'" من القائمة؟')) return;
  expiryList = expiryList.filter(x=>x.id!==id);
  saveExpiryData();
  renderExpiryPage();
  toast('🗑️ تم الحذف');
}

function expToggleAll(checked){
  document.querySelectorAll('.exp-chk').forEach(c=>c.checked=checked);
}

function expBulkDelete(){
  const ids = [...document.querySelectorAll('.exp-chk:checked')].map(c=>c.value);
  if(!ids.length){ toast('❗ اختر منتجات أولاً'); return; }
  if(!confirm('هتحذف '+ids.length+' منتج؟')) return;
  expiryList = expiryList.filter(p=>!ids.includes(p.id));
  saveExpiryData();
  renderExpiryPage();
  toast('🗑️ تم حذف '+ids.length+' منتج');
}

// ===== مزامنة Shopify =====
async function syncExpiryFromShopify(){
  if(!API_URL){ toast('❗ محتاج تكون متصل بالـ Backend'); return; }
  toast('⏳ جاري جلب المنتجات من Shopify...');
  try{
    const data = await apiFetch('/api/shopify/products');
    if(!data||!data.products){ toast('❌ فشل الجلب'); return; }
    let added = 0;
    data.products.forEach(p=>{
      const sku = p.variants?.[0]?.sku||'';
      const existing = expiryList.find(e=>e.sku===sku&&sku);
      if(!existing){
        expiryList.push({
          id: Date.now()+'_'+Math.random().toString(36).slice(2,5),
          name: p.title, sku, qty: p.variants?.[0]?.inventory_quantity||0,
          expDate: '', category: p.product_type||'',
          note: 'مستورد من Shopify', addedAt: new Date().toISOString()
        });
        added++;
      }
    });
    saveExpiryData();
    renderExpiryPage();
    toast('✅ تم استيراد '+added+' منتج جديد من Shopify — أضف تواريخ الانتهاء');
  }catch(e){
    toast('❌ خطأ: '+e.message);
  }
}

// ===== طباعة تقرير التصفية =====
function printExpiryReport(){
  const alertDays = expSettings.alertDays || 30;
  const toDispose = expiryList
    .filter(p=>{ const d=expDaysLeft(p.expDate); return d!==null&&d<=alertDays; })
    .sort((a,b)=>new Date(a.expDate)-new Date(b.expDate));

  if(!toDispose.length){ toast('لا توجد منتجات تحتاج تصفية حالياً'); return; }

  const now = new Date();
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;padding:20px;font-size:12px;direction:rtl}
    h2{font-size:15px;margin-bottom:4px;color:#000}
    p{color:#666;font-size:11px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse}
    th{background:#000;color:#fff;padding:7px 10px;font-size:11px;text-align:right}
    td{padding:7px 10px;border-bottom:1px solid #e0e0e0;font-size:11px}
    tr.expired td{background:#fff5f5;color:#991b1b}
    tr.soon td{background:#fffbeb}
    .badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
    tfoot td{background:#e8f8f0;font-weight:700}
    @media print{body{padding:5px}button{display:none}}
  </style></head><body>
  <h2>⏳ تقرير التصفية — CAFELAX</h2>
  <p>تاريخ الطباعة: ${now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · منتجات تنتهي خلال ${alertDays} يوم أو أقل · ${toDispose.length} منتج</p>
  <table>
    <thead><tr><th>#</th><th>المنتج</th><th>SKU</th><th>الكمية</th><th>تاريخ الانتهاء</th><th>الأيام المتبقية</th><th>الحالة</th></tr></thead>
    <tbody>
    ${toDispose.map((p,i)=>{
      const d=expDaysLeft(p.expDate);
      const cls=d<0?'expired':d<=30?'soon':'';
      const st=d<0?'منتهية':d===0?'اليوم!':d+' يوم';
      return`<tr class="${cls}"><td>${i+1}</td><td><strong>${p.name}</strong>${p.category?'<br><small>'+p.category+'</small>':''}</td><td style="direction:ltr">${p.sku||'—'}</td><td style="text-align:center">${p.qty||1}</td><td>${new Date(p.expDate).toLocaleDateString('ar-EG')}</td><td style="font-weight:700">${st}</td><td>${d<0?'🔴 منتهية':'🟡 قريباً'}</td></tr>`;
    }).join('')}
    </tbody>
    <tfoot><tr><td colspan="3"><strong>الإجمالي</strong></td><td style="text-align:center"><strong>${toDispose.reduce((s,p)=>s+(p.qty||1),0)}</strong></td><td colspan="3"></td></tr></tfoot>
  </table>
  <scr`+'ipt>window.onload=()=>window.print()</sc'+'ript></body></html>');
  w.document.close();
}

// تحقق من التنبيهات عند تحميل البرنامج
function checkExpiryAlerts(){
  const alertDays = expSettings.alertDays || 30;
  const urgent = expiryList.filter(p=>{
    const d = expDaysLeft(p.expDate);
    return d!==null && d<=alertDays;
  });
  if(urgent.length > 0){
    const nb = $('nb-expiry');
    if(nb) nb.textContent = urgent.length;
  }
}

// ===== تصدير Excel بوسطة =====
function exportBostaExcel(){
  const checked=[...document.querySelectorAll('.bosta-chk:checked')].map(c=>c.value);
  if(!checked.length){toast('❗ اختر طلبات أولاً');return;}
  const selectedOrders=orders.filter(o=>checked.includes(o.id));

  // ===== Mapping المحافظات =====
  const GOV_MAP={
    // القاهرة وضواحيها
    'cairo':'القاهرة','c':'القاهرة','hu':'القاهرة','egypt':'القاهرة',
    'nasr city':'القاهرة','nasr':'القاهرة','مدينة نصر':'القاهرة','مدينه نصر':'القاهرة',
    'new cairo':'القاهرة','التجمع':'القاهرة','5th settlement':'القاهرة','madinaty':'القاهرة',
    'rehab':'القاهرة','heliopolis':'القاهرة','هليوبوليس':'القاهرة',
    'garden city':'القاهرة','zamalek':'القاهرة','maadi':'القاهرة','المعادي':'القاهرة',
    'القاهرة':'القاهرة','القاهره':'القاهرة','shorouk':'القاهرة','الشروق':'القاهرة',
    'obour':'القاهرة','العبور':'القاهرة','badr':'القاهرة','بدر':'القاهرة',
    // الجيزة
    'giza':'الجيزة','gz':'الجيزة','su':'الجيزة','الجيزة':'الجيزة','الجيزه':'الجيزة',
    '6th of october':'الجيزة','6 october':'الجيزة','sheikh zayed':'الجيزة',
    'الشيخ زايد':'الجيزة','6th october':'الجيزة','october':'الجيزة',
    'haram':'الجيزة','الهرم':'الجيزة','dokki':'الجيزة','الدقي':'الجيزة','الدقى':'الجيزة',
    'agouza':'الجيزة','العجوزة':'الجيزة','mohandessin':'الجيزة','المهندسين':'الجيزة',
    'giza-haram':'الجيزة','westown':'الجيزة','new giza':'الجيزة',
    // الإسكندرية
    'alexandria':'الإسكندرية','alx':'الإسكندرية','alex':'الإسكندرية','alxandria':'الإسكندرية',
    'alexanderia':'الإسكندرية','الإسكندرية':'الإسكندرية','الاسكندرية':'الإسكندرية',
    'smouha':'الإسكندرية','semoha':'الإسكندرية','محرم بك':'الإسكندرية',
    // القليوبية
    'قليوبية':'القليوبية','kb':'القليوبية','القليوبية':'القليوبية',
    'shubra':'القليوبية','شبرا':'القليوبية',
    // المنوفية
    'mnf':'المنوفية','المنوفية':'المنوفية','منوفية':'المنوفية',
    // الغربية
    'gh':'الغربية','الغربية':'الغربية','gharbia':'الغربية','tanta':'الغربية','طنطا':'الغربية',
    // البحيرة
    'bh':'البحيرة','البحيرة':'البحيرة','damanhour':'البحيرة','دمنهور':'البحيرة',
    'wadi elnatrun':'البحيرة','وادي النطرون':'البحيرة',
    // الدقهلية
    'dk':'الدقهلية','الدقهلية':'الدقهلية','mansoura':'الدقهلية','المنصورة':'الدقهلية',
    'el mansoura':'الدقهلية','talkha':'الدقهلية','طلخا':'الدقهلية',
    // الشرقية
    'shr':'الشرقية','الشرقية':'الشرقية','zagazig':'الشرقية','الزقازيق':'الشرقية',
    // أسيوط
    'ast':'أسيوط','أسيوط':'أسيوط','اسيوط':'أسيوط','asyut':'أسيوط',
    // سوهاج
    'shg':'سوهاج','سوهاج':'سوهاج','sohag':'سوهاج',
    // قنا
    'qna':'قنا','قنا':'قنا','qena':'قنا','kn':'قنا','naga hammady':'قنا',
    // الأقصر
    'lx':'الأقصر','الأقصر':'الأقضر','luxor':'الأقصر',
    // أسوان
    'asn':'أسوان','أسوان':'أسوان','aswan':'أسوان',
    // الفيوم
    'fym':'الفيوم','الفيوم':'الفيوم','fayoum':'الفيوم',
    // بني سويف
    'bns':'بني سويف','بني سويف':'بني سويف','beni suef':'بني سويف',
    // المنيا
    'mn':'المنيا','المنيا':'المنيا','minya':'المنيا',
    // السويس
    'suz':'السويس','السويس':'السويس','suez':'السويس',
    // الإسماعيلية
    'is':'الإسماعيلية','الاسماعيليه':'الإسماعيلية','ismailia':'الإسماعيلية',
    // بور سعيد
    'pts':'بور سعيد','بور سعيد':'بور سعيد','port said':'بور سعيد',
    // دمياط
    'dt':'دمياط','دمياط':'دمياط','damietta':'دمياط',
    // كفر الشيخ
    'kfs':'كفر الشيخ','كفر الشيخ':'كفر الشيخ','kafr elshikh':'كفر الشيخ','kafr el sheikh':'كفر الشيخ',
    // البحر الأحمر
    'ba':'البحر الأحمر','البحر الأحمر':'البحر الأحمر','hurghada':'البحر الأحمر','الغردقة':'البحر الأحمر','الغردقه':'البحر الأحمر',
    // جنوب سيناء
    'js':'جنوب سيناء','جنوب سيناء':'جنوب سيناء',
    // مرسى مطروح
    'mt':'مرسى مطروح','مرسي مطروح':'مرسى مطروح','marsa matrouh':'مرسى مطروح',
  };

  function extractGov(area){
    if(!area||area==='—') return 'القاهرة';
    // الـ area بتكون "المحافظة - العنوان" أو "المدينة - العنوان"
    const parts=area.split(/\s*-\s*/);
    const govRaw=(parts[0]||'').trim().toLowerCase();
    // تحقق مباشر
    if(GOV_MAP[govRaw]) return GOV_MAP[govRaw];
    // تحقق جزئي
    for(const [key,val] of Object.entries(GOV_MAP)){
      if(govRaw.includes(key)||key.includes(govRaw)) return val;
    }
    // لو ما لقيناش، حاول من الـ addr
    return 'القاهرة'; // default
  }

  function extractArea(area){
    if(!area||area==='—') return '';
    const parts=area.split(/\s*-\s*/);
    return (parts[0]||'').trim().slice(0,50);
  }

  const headerRow1=['معلومات العميل','','','','','','','','','','','معلومات الاوردر','','','','','','','','','معلومات الشحنة المرتجة في حالة التبديل فقط','','','نوع الشحنة'];
  const headerRow2=['* اسم العميل','* تليفون','تليفون ثاني','* المدينة','المنطقة','* العنوان','علامة مميزة','عنوان عمل؟','رابط المكان','ملاحظات','','قيمة التحصيل النقدي','عدد القطع','وصف الشحنة','مرجع الطلب','قيمة الشحنة','الدفع بواسطة نقاط بوسطة؟','تطبيق رسوم Flexship','هل تسمح بفتح الشحنة؟','','عدد قطع المرتجع','وصف الشحنة المرتجعة','','نوع الشحنة'];

  const dataRows=selectedOrders.map(o=>{
    const area=o.area||'';
    const addr=(o.addr||area).replace(/\n/g,' ').slice(0,200);
    const cod=o.paid?0:(o.total||0);
    const shipVal=o.total||0;
    const orderRef=(o.id||'').replace(/^SH-/,'').replace(/^MN-/,'');
    const gov=extractGov(area);
    const areaName=extractArea(area);

    // عدد القطع ووصف المنتجات
    let itemCount=1, itemDesc='طلب من Cafelax';
    if(o.items && o.items.trim && o.items.trim()){
      // الصيغة من Shopify: "Product Name xN, Product Name xN"
      itemDesc = o.items.trim();
      // احسب عدد القطع الكلي من xN
      const qtyM = o.items.match(/x(\d+)/gi);
      if(qtyM && qtyM.length){
        itemCount = qtyM.reduce(function(s,m){return s+parseInt(m.slice(1));},0);
      } else {
        itemCount = o.items.split(',').length;
      }
    }

    return [
      o.name||'',
      o.phone||'',
      '',
      gov,
      areaName,
      addr,
      '',
      '',
      '',
      'في حالة حدوث اي مشكلة برجاء الاتصال علي 01080008017',
      '',
      cod>0?cod:'',
      itemCount,
      itemDesc,
      orderRef,
      shipVal,
      '','','','','','','',
      'Parcel',
    ];
  });

  const wsData=[headerRow1,headerRow2,...dataRows];
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols']=[{wch:25},{wch:15},{wch:15},{wch:20},{wch:20},{wch:40},{wch:15},{wch:10},{wch:15},{wch:40},{wch:5},{wch:18},{wch:10},{wch:60},{wch:15},{wch:12},{wch:12},{wch:12},{wch:12},{wch:5},{wch:12},{wch:20},{wch:5},{wch:15}];
  ws['!merges']=[
    {s:{r:0,c:0},e:{r:0,c:10}},
    {s:{r:0,c:11},e:{r:0,c:19}},
    {s:{r:0,c:20},e:{r:0,c:22}},
    {s:{r:0,c:23},e:{r:0,c:23}},
  ];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Add orders here');
  const now=new Date();
  const fname='Bosta_'+now.toLocaleDateString('en-GB').replace(/[/]/g,'-')+'_'+checked.length+'_orders.xlsx';
  XLSX.writeFile(wb,fname);
  toast('✅ تم تصدير '+checked.length+' طلب — '+fname);
}


// ===== REPORTS =====
function renderReports(){
  $('report-tbody').innerHTML=couriers.map(c=>{
    const all=oByC(c.id),done=oByC(c.id,'مكتمل'),cancel=oByC(c.id,'ملغي');
    const cod=done.reduce((a,o)=>a+o.total,0),ship=done.reduce((a,o)=>a+(o.ship||50),0),rate=all.length?Math.round(done.length/all.length*100):0;
    return`<tr><td><strong>${c.name}</strong></td><td>${all.length}</td><td>${done.length}</td><td>${cancel.length}</td><td class="mpos">${cod.toLocaleString()} ج</td><td class="mwarn">${ship.toLocaleString()} ج</td><td class="mpos">${(cod-ship).toLocaleString()} ج</td><td><span style="color:${rate>70?'var(--success)':'var(--warn)'};font-weight:700">${rate}%</span></td></tr>`}).join('');
}

// ===== NOTIFS =====
function pushNotif(icon,title,sub){notifications.unshift({id:Date.now(),icon,title,sub,time:'الآن',read:false});updateStats()}
function renderNotifs(){$('notifs-list').innerHTML=notifications.map(n=>`<div class="nitem ${n.read?'':'unread'}" onclick="markRead(${n.id})"><div class="nicon">${n.icon}</div><div class="nbody"><div class="ntitle">${n.title}</div><div class="nsub">${n.sub}</div></div><div class="ntime">${n.time}</div>${!n.read?'<div class="ndot"></div>':''}</div>`).join('')}
function markRead(id){notifications=notifications.map(n=>n.id===id?{...n,read:true}:n);updateStats();renderNotifs()}
function markAllRead(){notifications=notifications.map(n=>({...n,read:true}));updateStats();renderNotifs();toast('✅ تم تحديد الكل كمقروء')}

// ===== SETTINGS =====
function saveSettings(){defaultShip=+$('cfg-ship').value||50;toast('✅ تم حفظ الإعدادات')}

function selDays(btn, days) {
  document.querySelectorAll('#days-btns .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('imp-days').value = days;
}

async function doImport() {
  const url = $('imp-url').value.trim();
  const token = $('imp-token').value.trim();
  const days = +$('imp-days').value || 15;
  if (!url || !token) { toast('❗ أدخل رابط المتجر والـ Token'); return; }
  if (!API_URL) { toast('❗ الـ Backend مش متصل — اضبط الإعدادات أولاً'); return; }

  const btn = $('imp-btn');
  btn.innerHTML = '⏳ جاري الاستيراد...';
  btn.disabled = true;
  $('imp-result').style.display = 'none';
  $('imp-error').style.display = 'none';
  $('imp-progress').style.display = 'block';
  $('imp-progress-bar').style.width = '0%';
  $('imp-progress-pct').textContent = '0%';
  $('imp-fetched').textContent = 'جاري الاتصال بـ Shopify...';

  // simulate progress (الـ backend بياخد وقت)
  let fakeProgress = 0;
  const progressInterval = setInterval(() => {
    if(fakeProgress < 85) {
      fakeProgress += Math.random() * 8;
      $('imp-progress-bar').style.width = Math.min(fakeProgress,85) + '%';
      $('imp-progress-pct').textContent = Math.round(Math.min(fakeProgress,85)) + '%';
    }
  }, 600);

  // تحديث رسائل التقدم
  const daysLabel = days===1?'يوم واحد':days+' أيام';
  const msgs = [
    `جاري جلب طلبات آخر ${daysLabel}...`,
    'جاري معالجة الطلبات...',
    'جاري حفظ البيانات...',
    'تقريباً خلص...'
  ];
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    if(msgIdx < msgs.length) $('imp-fetched').textContent = msgs[msgIdx++];
  }, 3000);

  try {
    const res = await fetch(API_URL + '/api/import-shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopUrl: url, accessToken: token, days })
    });
    const data = await res.json();

    clearInterval(progressInterval);
    clearInterval(msgInterval);
    $('imp-progress-bar').style.width = '100%';
    $('imp-progress-pct').textContent = '100%';

    if (data.success) {
      $('imp-fetched').textContent = `✅ اكتمل! ${data.total} طلب في ${data.pages||1} صفحة`;
      $('imp-result').style.display = 'block';
      $('imp-result').innerHTML = `
        <strong>✅ ${data.message}</strong><br>
        <div style="margin-top:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div style="background:var(--card);border-radius:6px;padding:8px">
            <div style="font-size:20px;font-weight:800;color:var(--success)">${data.total}</div>
            <div style="font-size:10px;color:var(--muted)">إجمالي من Shopify</div>
          </div>
          <div style="background:var(--card);border-radius:6px;padding:8px">
            <div style="font-size:20px;font-weight:800;color:var(--accent)">${data.imported}</div>
            <div style="font-size:10px;color:var(--muted)">طلبات جديدة أُضيفت</div>
          </div>
          <div style="background:var(--card);border-radius:6px;padding:8px">
            <div style="font-size:20px;font-weight:800;color:var(--warn)">${data.updated}</div>
            <div style="font-size:10px;color:var(--muted)">طلبات موجودة</div>
          </div>
        </div>
        ${data.pages>1?`<div style="margin-top:6px;font-size:11px;color:var(--muted)">📄 ${data.pages} صفحة × 250 طلب</div>`:''}`;
      localStorage.setItem('orderpro_shop_url', url);
      localStorage.setItem('orderpro_shop_token', token);
      if($('cfg-shop')) $('cfg-shop').value = url;
      if($('cfg-token')) $('cfg-token').value = token;
      await loadOrders();
      pushNotif('📥', `تم استيراد ${data.imported} طلب من Shopify`, `آخر ${days} ${days===1?'يوم':'أيام'} · ${data.total} طلب إجمالي`);
    } else {
      $('imp-progress').style.display = 'none';
      $('imp-error').style.display = 'block';
      $('imp-error').innerHTML = '❌ ' + (data.error || 'حدث خطأ غير متوقع');
    }
  } catch (err) {
    clearInterval(progressInterval);
    clearInterval(msgInterval);
    $('imp-progress').style.display = 'none';
    $('imp-error').style.display = 'block';
    $('imp-error').innerHTML = '❌ فشل الاتصال: ' + err.message;
  } finally {
    btn.innerHTML = '📥 استيراد الآن';
    btn.disabled = false;
  }
}
function inviteUser(){const email=$('u-email').value.trim();if(!email){toast('❗ أدخل البريد');return}users.push({email,role:$('u-role').value,name:email.split('@')[0]});$('u-email').value='';renderUsers();toast(`📨 تم إرسال دعوة لـ ${email}`)}
function renderUsers(){$('users-list').innerHTML=users.map((u,i)=>`<div class="uitem"><div class="uav" style="background:${COLORS[i%COLORS.length]}">${u.name[0].toUpperCase()}</div><div style="flex:1"><div style="font-size:12px;font-weight:600">${u.name}</div><div style="font-size:10px;color:var(--muted)">${u.email}</div></div><span class="badge b-new">${ROLE_L[u.role]||u.role}</span></div>`).join('')}

// ===== DOWNLOAD BACKEND =====
function downloadBackend(){
  const srv=`const express=require('express');const crypto=require('crypto');const cors=require('cors');const app=express();const PORT=process.env.PORT||3000;let orders=[];let nextId=1;app.use(cors({origin:'*'}));app.use('/webhook/shopify',express.raw({type:'application/json'}));app.use(express.json());app.post('/webhook/shopify',(req,res)=>{const secret=process.env.SHOPIFY_WEBHOOK_SECRET||'';if(secret){const hmac=req.headers['x-shopify-hmac-sha256'];const hash=crypto.createHmac('sha256',secret).update(req.body).digest('base64');if(hash!==hmac)return res.status(401).json({error:'Unauthorized'});}const sh=JSON.parse(req.body);const order={id:'SH-'+sh.order_number,shopifyId:sh.id,src:'shopify',name:sh.shipping_address?(sh.shipping_address.first_name+' '+sh.shipping_address.last_name):(sh.customer?(sh.customer.first_name+' '+sh.customer.last_name):'عميل'),phone:(sh.shipping_address&&sh.shipping_address.phone)||( sh.customer&&sh.customer.phone)||'—',area:sh.shipping_address?[sh.shipping_address.city,sh.shipping_address.address1].filter(Boolean).join(' - '):'—',total:parseFloat(sh.total_price)||0,ship:50,courierId:null,status:'جديد',time:new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}),note:sh.note||'',items:(sh.line_items||[]).map(i=>i.name+' x'+i.quantity).join(', '),shippingMethod:(sh.shipping_lines&&sh.shipping_lines[0]?sh.shipping_lines[0].title:''),deliveryType:(sh.shipping_lines&&sh.shipping_lines[0]&&sh.shipping_lines[0].title.toLowerCase().includes('same day')?'express':'normal'),createdAt:new Date().toISOString()};orders.unshift(order);console.log('New order:',order.id,order.name);res.status(200).json({received:true});});app.get('/api/orders',(req,res)=>res.json({orders,total:orders.length}));app.post('/api/orders',(req,res)=>{const order={id:'MN-'+(1000+nextId++),src:'manual',createdAt:new Date().toISOString(),time:new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}),status:'في الانتظار',courierId:null,ship:50,...req.body};orders.unshift(order);res.json({order});});app.patch('/api/orders/:id',(req,res)=>{const order=orders.find(o=>o.id===req.params.id);if(!order)return res.status(404).json({error:'not found'});Object.assign(order,req.body);res.json({order});});app.delete('/api/orders/:id',(req,res)=>{orders=orders.filter(o=>o.id!==req.params.id);res.json({ok:true});});app.get('/',(req,res)=>res.json({status:'✅ OrderPro Backend شغال',orders:orders.length,uptime:Math.floor(process.uptime())+' ثانية'}));app.listen(PORT,()=>console.log('OrderPro Backend on port',PORT));`;
  const pkg=JSON.stringify({name:"orderpro-backend",version:"1.0.0",main:"server.js",scripts:{start:"node server.js"},dependencies:{cors:"^2.8.5",express:"^4.18.2"},engines:{node:">=18.0.0"}},null,2);
  const dl=(content,name,type)=>{const a=document.createElement('a');a.href='data:'+type+';charset=utf-8,'+encodeURIComponent(content);a.download=name;a.click()};
  dl(srv,'server.js','text/javascript');
  setTimeout(()=>dl(pkg,'package.json','application/json'),600);
  toast('✅ تم تحميل server.js و package.json — ارفعهم على Railway');
}

// ===== NAV =====
function goPage(el,page){
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));el.classList.add('active');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$('page-'+page).classList.add('active');
  currentPage=page;$('ptitle').textContent=PAGE_T[page]||'';
  if(page==='couriers')renderCouriers();if(page==='assign')renderAssignPage();
  if(page==='pickup')renderPickupPage();if(page==='transit')renderTransitPage();
  if(page==='bosta')renderBostaPage();
  if(page==='shop-accounting')renderShopAccounting();
  if(page==='checks')renderChecksPage();
  if(page==='courier-orders')renderCourierOrdersPage();
  if(page==='problems')renderProblemsPage();
  if(page==='import-excel')renderImportExcelPage();
  if(page==='accounting'){renderAcc();renderAccDet();}if(page==='reports')renderReports();
  if(page==='notifs')renderNotifs();
  if(page==='settings')renderUsersAdmin();
  if(page==='delivery-sheet')dsInit();
  if(page==='expiry')renderExpiryPage();
}

function refreshSelects(){const opts='<option value="">— بدون تعيين الآن —</option>'+couriers.map(c=>`<option value="${c.id}">${c.name} (${c.zone})</option>`).join('');$('o-courier').innerHTML=opts}
// ===== BULK ACTIONS - ORDERS =====
function ordToggleAll(val){
  document.querySelectorAll('.ord-chk').forEach(c=>c.checked=val);
  updateOrdersBulk();
}
function ordDeselectAll(){
  document.querySelectorAll('.ord-chk').forEach(c=>c.checked=false);
  if($('ord-check-all'))$('ord-check-all').checked=false;
  updateOrdersBulk();
}
function updateOrdersBulk(){
  const chks=[...document.querySelectorAll('.ord-chk:checked')];
  const bar=$('orders-bulk-bar');
  if(bar){
    bar.style.display=chks.length?'flex':'none';
    const cnt=$('orders-sel-count');
    if(cnt)cnt.textContent=chks.length+' طلب محدد';
  }
}
async function ordBulkMarkPaid(){
  const ids=[...document.querySelectorAll('.ord-chk:checked')].map(c=>c.value);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o&&!o.paid){o.paid=true;if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{paid:true}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('💳 تم تحويل '+ids.length+' طلب لمدفوع');
}
async function ordBulkMarkDone(){
  const ids=[...document.querySelectorAll('.ord-chk:checked')].map(c=>c.value);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o&&o.status!=='مكتمل'){o.status='مكتمل';if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{status:'مكتمل'}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('✅ تم تحديد '+ids.length+' طلب كمكتمل');
}
async function ordBulkCancel(){
  const ids=[...document.querySelectorAll('.ord-chk:checked')].map(c=>c.value);
  if(!confirm('هتلغي '+ids.length+' طلب؟'))return;
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o){o.status='ملغي';if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{status:'ملغي'}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('❌ تم إلغاء '+ids.length+' طلب');
}
async function ordBulkAddProblem(){
  const ids=[...document.querySelectorAll('.ord-chk:checked')].map(c=>c.value);
  for(const id of ids){
    const o=orders.find(x=>x.id===id);
    if(o&&!o.hasProblem){o.hasProblem=true;if(API_URL)apiFetch('/api/orders/'+id,'PATCH',{hasProblem:true}).catch(()=>{});}
  }
  try{localStorage.setItem('orderpro_orders',JSON.stringify(orders));}catch(e){}
  refreshAll();toast('⚠️ تم إضافة '+ids.length+' طلب لصفحة المشاكل');
  if(currentPage!=='problems'){goPage(document.querySelector('[data-p="problems"]'),'problems');}
}

function refreshAll(){updateStats();renderDash();renderOrders();if(currentPage==='assign')renderAssignPage();if(currentPage==='pickup')renderPickupPage();if(currentPage==='transit')renderTransitPage();if(currentPage==='bosta')renderBostaPage();
  if(currentPage==='shop-accounting')renderShopAccounting();
  if(currentPage==='checks')renderChecksPage();
  if(currentPage==='expiry')renderExpiryPage();if(currentPage==='courier-orders')renderCourierOrdersPage();if(currentPage==='problems')renderProblemsPage();if(currentPage==='couriers')renderCouriers();if(currentPage==='accounting'){renderAcc();renderAccDet();}if(currentPage==='reports')renderReports();if(currentPage==='notifs')renderNotifs()}

// ===== DELIVERY SHEET =====
let dsMode='full', dsZone='all';

const DS_HEADERS=`<thead><tr>
  <th style="width:50px">الطلب</th>
  <th style="width:55px">النوع</th>
  <th style="width:80px">العميل</th>
  <th style="width:60px">المنطقة</th>
  <th style="width:80px">الهاتف</th>
  <th>العنوان</th>
  <th style="width:68px;text-align:center">التحصيل</th>
  <th style="width:22px;text-align:center">✓</th>
</tr></thead>`;

function dsOrderRow(o,cls){
  const dt=deliveryType(o);
  const dtLabel=dt==='express'?'⚡':'🚚';
  const dtColor=dt==='express'?'color:#7f1d1d;background:#fee2e2':'color:#065f46;background:#dcfce7';
  const areaShort=shortArea(o.area);
  const addr=(o.addr||'').replace(/\n/g,' ').slice(0,45);
  // تحقق إذا كان الطلب جديد بعد آخر طباعة
  const cId=window._dsCourierId||0;
  const lastPrint=cId&&dsLastPrintTimes[cId]?dsLastPrintTimes[cId]:0;
  const orderTime=o.createdAt?new Date(o.createdAt).getTime():0;
  const isNew=lastPrint>0&&orderTime>lastPrint;
  const newBadge=isNew?'<span style="background:#3ab877;color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:10px;margin-right:3px">جديد</span>':'';
  const rowStyle=isNew?'font-size:10px;line-height:1.2;border-right:3px solid #3ab877;background:#f0fdf4':'font-size:10px;line-height:1.2';
  return`<tr class="${cls}" style="${rowStyle}">
    <td style="font-weight:700;white-space:nowrap;font-size:11px">${newBadge}${o.id.replace('SH-','#').replace('MN-','#')}</td>
    <td style="text-align:center"><span style="padding:1px 4px;border-radius:6px;font-size:9px;font-weight:700;${dtColor}">${dtLabel}</span></td>
    <td style="font-weight:600;font-size:10px">${o.name}</td>
    <td style="font-size:10px">${areaShort}</td>
    <td style="direction:ltr;text-align:right;font-size:9px">${o.phone||'—'}</td>
    <td style="font-size:9px;color:#555;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${addr||areaShort}</td>
    <td style="font-weight:700;text-align:left;white-space:nowrap;font-size:10px">${o.paid?'💳':o.total.toLocaleString()+' ج'}</td>
    <td style="text-align:center"><span style="display:inline-block;width:60px;height:14px;border:1px solid #ccc;border-radius:3px"></span></td>
  </tr>`;
}


function dsInit(){
  const sel=$('ds-courier-sel');
  // فلتر المناديب الفعليين (الذين عندهم طلبات نشطة أولاً)
  const activeCids=new Set(orders.filter(o=>o.status==='جاري التوصيل'&&!isPickup(o)&&!isTransit(o)).map(o=>String(o.courierId)));
  const sorted=[
    ...couriers.filter(c=>activeCids.has(String(c.id))),
    ...couriers.filter(c=>!activeCids.has(String(c.id)))
  ];
  let opts=sorted.map(c=>{
    const cnt=orders.filter(o=>String(o.courierId)===String(c.id)&&o.status==='جاري التوصيل'&&!isPickup(o)&&!isTransit(o)).length;
    return '<option value="'+c.id+'">'+c.name+(cnt?' ('+cnt+')':'')+'</option>';
  }).join('');
  // إضافة بوسطة لو في طلبات مرفوعة
  const bostaCnt=orders.filter(o=>o.bostaId&&o.status==='جاري التوصيل').length;
  if(bostaCnt>0) opts+='<option value="bosta">🚚 بوسطة ('+bostaCnt+')</option>';
  sel.innerHTML=opts;
  dsRender();
}

function dsSetMode(m){
  dsMode=m;dsZone='all';
  ['full','exp','zone'].forEach(x=>$('ds-btn-'+x).classList.remove('active'));
  const map={full:'full',express:'exp',zone:'zone'};
  $('ds-btn-'+map[m]).classList.add('active');
  const picker=$('ds-zone-picker');
  if(m==='zone'){picker.classList.add('visible');dsBuildZones();}
  else picker.classList.remove('visible');
  dsRender();
}

function dsBuildZones(){
  const cId=+$('ds-courier-sel').value;
  const normalOrders=orders.filter(o=>String(o.courierId)===String(cId)&&!isSameDay(o)&&o.status==='جاري التوصيل');
  // استخدم مناطق المندوب من تعريفه مباشرةً (مش العناوين)
  const cForPills=couriers.find(x=>x.id==cId);
  const courierDefinedZones = cForPills
    ? (cForPills.zone||'').split(/[،,\/\-–\n]+/).map(z=>z.trim()).filter(z=>z.length>1)
    : [];
  // اجمع المناطق الفعلية المستخدمة في الطلبات
  const usedZones = [...new Set(normalOrders.map(o=>o.assignedZone||getOrderZoneForCourier(o,cForPills)||'أخري'))];
  // الترتيب: مناطق المندوب المستخدمة أولاً بترتيب تعريفه ثم أخري
  const sortedPills = [
    ...courierDefinedZones.filter(z=>usedZones.includes(z)),
    ...usedZones.filter(z=>z==='أخري'),
    ...usedZones.filter(z=>!courierDefinedZones.includes(z)&&z!=='أخري'),
  ];
  const zones = sortedPills; // للاستخدام في الـ filter أدناه
  const pillsEl=$('ds-zone-pills');
  if(pillsEl){
    const allBtn=document.createElement('button');
    allBtn.className='zpill on';allBtn.textContent='كل المناطق';
    allBtn.onclick=function(){dsSelZone('all',this);};
    pillsEl.innerHTML='';pillsEl.appendChild(allBtn);
    sortedPills.forEach(function(z){
      const count=normalOrders.filter(o=>(o.assignedZone||getOrderZoneForCourier(o,cForPills)||'أخري')===z).length;
      const isOther=z==='أخري';
      const btn=document.createElement('button');
      btn.className='zpill'+(isOther?' zone-other':'');
      btn.innerHTML=z+' <span style="opacity:.7;font-size:10px">('+count+')</span>';
      btn.onclick=function(){dsSelZone(z,this);};
      pillsEl.appendChild(btn);
    });
  }
}

function dsSelZone(z,el){
  dsZone=z;
  document.querySelectorAll('.zpill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  dsRender();
}

function doPrint(){
  // حفظ وقت الطباعة للمندوب الحالي
  const cId = $('ds-courier-sel')?.value;
  if(cId){
    dsLastPrintTimes[cId] = Date.now();
    try{localStorage.setItem('ds_last_print',JSON.stringify(dsLastPrintTimes));}catch(e){}
  }
  window.print();
}

function dsRender(){
  const cId=$('ds-courier-sel').value;
  const c=couriers.find(x=>String(x.id)===String(cId));
  window._dsCourierId = cId; // للاستخدام في dsOrderRow
  if(!c){$('ds-sheet').innerHTML='<div style="padding:30px;text-align:center;color:var(--muted)">لا يوجد مناديب</div>';return;}

  // مقارنة شاملة للـ courierId (number أو string أو 'bosta')
  const courierOrders=orders.filter(o=>{
    const oc=String(o.courierId||'');
    const cc=String(cId||'');
    const match = (oc===cc && oc!=='') || (cc==='bosta' && o.isBosta);
    return match && o.status==='جاري التوصيل'&&!isPickup(o)&&!isTransit(o);
  });
  const express=courierOrders.filter(o=>isSameDay(o));
  let normal=courierOrders.filter(o=>!isSameDay(o));
  normal.sort((a,b)=>(a.area||'').localeCompare((b.area||''),'ar'));

  let showExp=[],showNorm=[],modeBadge='',modeTitle='';
  if(dsMode==='full'){
    showExp=express;showNorm=normal;
    modeBadge='<span class="ds-mode-badge ds-mb-full">طباعة مجمعة</span>';
    modeTitle='ورقة توصيل يومية — كاملة';
  } else if(dsMode==='express'){
    showExp=express;showNorm=[];
    modeBadge='<span class="ds-mode-badge ds-mb-exp">⚡ مستعجل فقط</span>';
    modeTitle='ورقة توصيل — مستعجل فقط';
  } else {
    showExp=[];
    showNorm=dsZone==='all'?normal:normal.filter(o=>{
      const oz=o.assignedZone||getOrderZoneForCourier(o,c)||'أخري';
      return oz===dsZone;
    });
    const zl=dsZone==='all'?'كل المناطق':dsZone;
    modeBadge=`<span class="ds-mode-badge ds-mb-zone">📍 ${zl}</span>`;
    modeTitle=`ورقة توصيل — ${zl}`;
  }

  const all=[...showExp,...showNorm];
  if(!all.length){$('ds-sheet').innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">لا توجد طلبات في هذا الاختيار</div>';return;}

  const totalCod=all.filter(o=>!o.paid).reduce((s,o)=>s+o.total,0);
  const shipFee=showExp.reduce((s,o)=>s+(o.ship||c.shipExpress||80),0)+showNorm.reduce((s,o)=>s+(o.ship||c.ship||50),0);

  // Express section
  let expHtml='';
  if(showExp.length){
    expHtml=`
      <div class="ds-sec"><div class="ds-sec-line"></div>
        <span class="ds-sec-lbl dsl-exp">⚡ مستعجل — ${showExp.length} طلب</span>
        <div class="ds-sec-line"></div></div>
      <table class="ds-table">${DS_HEADERS}<tbody>
        ${showExp.map(o=>dsOrderRow(o,'ds-er')).join('')}
      </tbody></table>`;
  }

  // Normal section grouped by zone
  let normHtml='';
  if(showNorm.length){
    const zones={};
    showNorm.forEach(o=>{
      // استخدم منطقة المندوب المحددة أو احسبها أو "أخري"
      const oz = o.assignedZone || getOrderZoneForCourier(o,c) || 'أخري';
      if(!zones[oz])zones[oz]=[];
      zones[oz].push(o);
    });
    let rows='';
    let rowCount=showExp.length;
    // ترتيب: مناطق المندوب أولاً ثم أخري
    const courierZones = (c.zone||'').split(/[،,\/\-–\n]+/).map(z=>z.trim()).filter(z=>z.length>1);
    const zoneKeys = Object.keys(zones);
    const sortedZones = [
      ...courierZones.filter(z=>zoneKeys.includes(z)),
      ...zoneKeys.filter(z=>z==='أخري'),
      ...zoneKeys.filter(z=>!courierZones.includes(z)&&z!=='أخري'),
    ];
    sortedZones.forEach(function(z){
      const zo=zones[z]; if(!zo) return;
      const isOther = z==='أخري';
      const hdrColor = isOther ? 'color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:4px' : 'color:var(--muted)';
      const hdrLabel = '📍 '+z+' · '+zo.length+' طلب'+(isOther?' ⚠️':'');
      rows += '<tr class="ds-zone-hdr"><td colspan="8"><span style="font-size:10px;font-weight:700;'+hdrColor+'">'+hdrLabel+'</span></td></tr>';
      zo.forEach(o=>{
        if(rowCount>0&&rowCount%20===0){
          rows+='</tbody></table><div style="page-break-after:always"></div><table class="ds-table">'+DS_HEADERS+'<tbody>';
        }
        rows+=dsOrderRow(o,'ds-nr');
        rowCount++;
      });
    });
    normHtml=`
      <div class="ds-sec" style="margin-top:6px"><div class="ds-sec-line"></div>
        <span class="ds-sec-lbl dsl-norm">🚚 عادي — ${showNorm.length} طلب</span>
        <div class="ds-sec-line"></div></div>
      <table class="ds-table">${DS_HEADERS}<tbody>${rows}</tbody></table>`;
  }

  const today=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const nowt=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});

  $('ds-sheet').innerHTML=`
    <div class="ds-hd">
      <div>
        <div class="ds-title">${modeTitle}</div>
        <div class="ds-sub">OrderPro · نظام إدارة التوصيل</div>
        <div style="margin-top:4px">${modeBadge}</div>
      </div>
      <div>
        <div class="ds-courier-name">${c.name}</div>
        <div class="ds-date">${today}</div>
        <div style="font-size:11px;color:var(--muted);text-align:right;margin-top:2px">📱 ${c.phone}</div>
        <div style="font-size:11px;color:var(--muted);text-align:right">📍 ${c.zone}</div>
      </div>
    </div>

    <div class="ds-sum">
      <div class="ds-sbox"><div class="ds-snum" style="color:var(--accent)">${all.length}</div><div class="ds-slbl">إجمالي الطلبات</div></div>
      <div class="ds-sbox"><div class="ds-snum" style="color:var(--danger)">${showExp.length}</div><div class="ds-slbl">⚡ مستعجل</div></div>
      <div class="ds-sbox"><div class="ds-snum" style="color:var(--info)">${showNorm.length}</div><div class="ds-slbl">🚚 عادي</div></div>
      <div class="ds-sbox"><div class="ds-snum" style="color:var(--success)">${totalCod.toLocaleString()} ج</div><div class="ds-slbl">إجمالي التحصيل</div></div>
    </div>

    ${expHtml}
    ${normHtml}

    <div class="ds-foot">
      <div>
        <div class="ds-trow"><span>إجمالي COD</span><span>${totalCod.toLocaleString()} ج</span></div>
        <div class="ds-trow"><span>تمن الشحن المستحق</span><span style="color:var(--warn)">${shipFee.toLocaleString()} ج</span></div>
        <div class="ds-trow big"><span>صافي للمحل</span><span>${(totalCod-shipFee).toLocaleString()} ج</span></div>
      </div>
      <div><div class="ds-sig-line"></div><div class="ds-sig-lbl">توقيع المندوب — استلام الطلبات</div></div>
      <div><div class="ds-sig-line"></div><div class="ds-sig-lbl">توقيع المشرف — استلام الكاش</div></div>
    </div>

    <div class="ds-meta">
      <span>OrderPro · ${today} · ${nowt}</span>
      <span>${all.length} طلبات · ${c.name}</span>
    </div>`;
}

// ===== INIT =====
if(API_URL){$('cfg-api').value=API_URL;$('cfg-api2').value=API_URL;updateWebhook();testBackend()}
// تحميل بيانات Shopify المحفوظة
const savedShopUrl=localStorage.getItem('orderpro_shop_url');
const savedShopToken=localStorage.getItem('orderpro_shop_token');
if(savedShopUrl){$('imp-url').value=savedShopUrl;if($('cfg-shop'))$('cfg-shop').value=savedShopUrl;}
if($('cfg-api'))$('cfg-api').value=API_URL;
if($('cfg-api2'))$('cfg-api2').value=API_URL;
if(savedShopToken){$('imp-token').value=savedShopToken;if($('cfg-token'))$('cfg-token').value=savedShopToken;}
// تحميل بيانات بوسطة
bostaPickupAddress=localStorage.getItem('bosta_pickup_address')||'';
bostaPickupCity=localStorage.getItem('bosta_pickup_city')||'القاهرة';
refreshSelects();renderUsers();refreshAll();
</script>

<style>
#batch-overlay{position:fixed;inset:0;background:rgba(15,23,42,.96);z-index:5000;display:none;align-items:center;justify-content:center;padding:20px}
#batch-overlay.active{display:flex}
#batch-overlay>div{background:#fff;border-radius:20px;width:min(680px,96vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,.4)}
</style>

<div id="batch-resume-float" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:4000;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:30px;padding:12px 24px;font-family:Cairo,sans-serif;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,.4);display:none;align-items:center;gap:10px" onclick="resumeBatch()">
  <span id="batch-float-text">📦 استكمال الدفعة</span>
  <button onclick="event.stopPropagation();endBatch()" style="background:rgba(255,255,255,.25);border:none;color:#fff;border-radius:20px;padding:3px 10px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer">إنهاء ✕</button>
</div>

<div id="batch-overlay">
  <div>
    <div style="height:5px;background:#e2e8f0;overflow:hidden"><div id="batch-progress-bar" style="height:100%;background:linear-gradient(to right,#3b82f6,#6366f1);width:0%;transition:width .4s"></div></div>
    <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px">
      <span id="batch-name-badge" style="background:#eff6ff;color:#3b82f6;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">الدفعة</span>
      <span id="batch-counter" style="font-size:13px;color:#64748b"></span>
      <button onclick="minimizeBatch()" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;padding:6px 14px;font-family:Cairo,sans-serif;font-weight:700;font-size:12px;cursor:pointer" title="رجوع للتوزيع والاستكمال لاحقاً">⬇ تصغير</button>
    </div>
    <div style="padding:16px;flex:1;overflow-y:auto">
      <div id="batch-pickup-alert" style="display:none;background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;padding:12px;text-align:center;font-size:14px;font-weight:700;color:#92400e;margin-bottom:10px">🏪 هذا الطلب استلام من المحل</div>
      <div id="batch-order-card" style="border:2px solid #e2e8f0;border-radius:14px;padding:16px;background:#f8fafc;margin-bottom:12px">
        <div id="batch-order-id"></div>
        <div id="batch-order-name"></div>
        <div id="batch-order-meta" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"></div>
        <div id="batch-order-addr"></div>
        <div id="batch-order-amount"></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:8px">وزّع على:</div>
      <div id="batch-couriers-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:10px"></div>
    </div>
    <div style="padding:12px 16px;border-top:1px solid #e2e8f0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button onclick="batchMarkPickup()" id="batch-pickup-btn" style="display:none;background:#10b981;color:#fff;border:none;border-radius:9px;padding:10px 16px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">✅ استلام محل</button>
      <button onclick="batchSkip()" style="background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:9px;padding:10px 16px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">⏭ تخطي</button>
      <button onclick="batchPrev()" id="batch-prev-btn" style="display:none;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:9px;padding:10px 16px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">◀ السابق</button>
      <span id="batch-hint" style="margin-right:auto;font-size:12px;color:#64748b">اختر مندوباً</span>
    </div>
  </div>
</div>

<div class="overlay" id="m-zone-edit">
  <div class="modal" style="width:400px">
    <div class="mhd"><h3>✏️ تعديل منطقة الطلب</h3><button class="xbtn" onclick="closeM('m-zone-edit')">✕</button></div>
    <div class="mbody">
      <div id="zone-edit-order-info" style="background:var(--bg);border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px"></div>
      <div class="fg">
        <label>اختر منطقة من مناطق المندوب</label>
        <div id="zone-edit-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)"></div>
      </div>
      <div class="fg" style="margin-top:8px">
        <label>أو اكتب يدوياً</label>
        <input id="zone-edit-input" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:14px" placeholder="اكتب اسم المنطقة...">
      </div>
    </div>
    <div class="mft">
      <button class="btn btn-ghost" onclick="closeM('m-zone-edit')">إلغاء</button>
      <button class="btn btn-primary" onclick="saveZoneEdit()">💾 حفظ</button>
    </div>
  </div>
</div>

<!-- ===== EXPIRY PAGE ===== -->
<div class="page" id="page-expiry">

  <!-- Stats Bar -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div class="sc" style="border-right:4px solid var(--danger)">
      <div class="sc-icon">🔴</div>
      <div class="sc-label">منتهية الصلاحية</div>
      <div class="sc-val" id="exp-stat-expired" style="color:var(--danger)">0</div>
    </div>
    <div class="sc" style="border-right:4px solid var(--warn)">
      <div class="sc-icon">🟡</div>
      <div class="sc-label">تنتهي خلال 30 يوم</div>
      <div class="sc-val" id="exp-stat-soon" style="color:var(--warn)">0</div>
    </div>
    <div class="sc" style="border-right:4px solid var(--info)">
      <div class="sc-icon">🔵</div>
      <div class="sc-label">تنتهي خلال 90 يوم</div>
      <div class="sc-val" id="exp-stat-ok" style="color:var(--info)">0</div>
    </div>
    <div class="sc" style="border-right:4px solid var(--success)">
      <div class="sc-icon">✅</div>
      <div class="sc-label">إجمالي المنتجات</div>
      <div class="sc-val" id="exp-stat-total" style="color:var(--success)">0</div>
    </div>
  </div>

  <!-- Controls -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-body" style="padding:10px 14px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <!-- Filter chips -->
        <div style="display:flex;gap:5px;flex-wrap:wrap" id="exp-filter-chips">
          <button class="chip on" onclick="expSetFilter('all',this)">الكل</button>
          <button class="chip" onclick="expSetFilter('expired',this)" style="color:var(--danger)">🔴 منتهية</button>
          <button class="chip" onclick="expSetFilter('soon',this)" style="color:var(--warn)">🟡 خلال 30 يوم</button>
          <button class="chip" onclick="expSetFilter('ok',this)" style="color:var(--info)">🔵 خلال 90 يوم</button>
          <button class="chip" onclick="expSetFilter('safe',this)" style="color:var(--success)">✅ آمنة</button>
        </div>
        <!-- Search -->
        <input id="exp-search" placeholder="ابحث عن منتج..." oninput="renderExpiryPage()"
          style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;width:180px">
        <!-- Alert days -->
        <div style="display:flex;align-items:center;gap:6px;font-size:12px">
          <label style="color:var(--muted)">تنبيه قبل:</label>
          <input id="exp-alert-days" type="number" value="30" min="1" max="365" onchange="saveExpSettings()"
            style="width:55px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:Cairo,sans-serif;text-align:center">
          <span style="color:var(--muted)">يوم</span>
        </div>
        <div style="margin-right:auto;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="syncExpiryFromShopify()">🔄 مزامنة Shopify</button>
          <button class="btn btn-ghost btn-sm" onclick="printExpiryReport()">🖨️ طباعة التصفية</button>
          <button class="btn btn-primary btn-sm" onclick="openAddExpiry()">+ إضافة منتج</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Table -->
  <div class="card">
    <div class="card-hd">
      <h3>⏳ قائمة الصلاحيات</h3>
      <span id="exp-count" style="font-size:12px;color:var(--muted)"></span>
      <button class="btn btn-ghost btn-sm" onclick="expBulkDelete()" style="margin-right:auto;color:var(--danger)">🗑️ حذف المحددة</button>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th style="width:30px"><input type="checkbox" id="exp-check-all" onchange="expToggleAll(this.checked)"></th>
        <th>المنتج</th>
        <th>الباركود / SKU</th>
        <th>الكمية</th>
        <th>تاريخ الانتهاء</th>
        <th>الأيام المتبقية</th>
        <th>الحالة</th>
        <th>إجراءات</th>
      </tr></thead>
      <tbody id="exp-tbody"></tbody>
    </table></div>
  </div>
</div>

<!-- MODAL: إضافة/تعديل منتج -->
<div class="overlay" id="m-expiry">
  <div class="modal" style="width:500px">
    <div class="mhd"><h3 id="exp-modal-title">➕ إضافة منتج</h3><button class="xbtn" onclick="closeM('m-expiry')">✕</button></div>
    <div class="mbody">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="fg" style="grid-column:1/-1"><label>اسم المنتج *</label><input id="exp-name" placeholder="مثال: نسكافيه جولد 200 جرام"></div>
        <div class="fg"><label>SKU / باركود</label><input id="exp-sku" placeholder="اختياري"></div>
        <div class="fg"><label>الكمية</label><input id="exp-qty" type="number" value="1" min="0"></div>
        <div class="fg"><label>تاريخ الانتهاء *</label><input id="exp-date" type="date"></div>
        <div class="fg"><label>الفئة</label><input id="exp-category" placeholder="مثال: قهوة، شاي..."></div>
        <div class="fg" style="grid-column:1/-1"><label>ملاحظات</label><textarea id="exp-note" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px"></textarea></div>
      </div>
    </div>
    <div class="mft">
      <button class="btn btn-ghost" onclick="closeM('m-expiry')">إلغاء</button>
      <button class="btn btn-primary" onclick="saveExpiry()">💾 حفظ</button>
    </div>
  </div>
</div>

<!-- MODAL: إضافة/تعديل مستخدم -->
<div class="overlay" id="m-add-user">
  <div class="modal" style="width:520px;max-height:90vh;overflow-y:auto">
    <div class="mhd"><h3 id="add-user-modal-title">+ مستخدم جديد</h3><button class="xbtn" onclick="closeM('m-add-user')">✕</button></div>
    <div class="mbody">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">
        <div class="fg"><label>الاسم الكامل *</label><input id="au-name" placeholder="مثال: أحمد محمد"></div>
        <div class="fg"><label>اسم المستخدم *</label><input id="au-username" placeholder="مثال: ahmed" style="direction:ltr"></div>
      </div>
      <div class="fg">
        <label>كلمة المرور * <span id="au-pass-hint" style="font-size:11px;color:var(--muted);font-weight:400">(اتركها فارغة للإبقاء على القديمة)</span></label>
        <input type="password" id="au-pass" placeholder="كلمة المرور">
      </div>
      <div class="fg">
        <label style="margin-bottom:8px;display:block">الصفحات المتاحة *</label>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px">
          <button type="button" class="btn btn-ghost btn-xs" onclick="auSelectAll(true)">تحديد الكل</button>
          <button type="button" class="btn btn-ghost btn-xs" onclick="auSelectAll(false)">إلغاء الكل</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--bg);border-radius:8px;padding:8px;border:1px solid var(--border)">
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="dashboard" style="width:15px;height:15px;accent-color:var(--accent)"> 🏠 لوحة التحكم</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="orders" style="width:15px;height:15px;accent-color:var(--accent)"> 📋 الطلبات</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="couriers" style="width:15px;height:15px;accent-color:var(--accent)"> 🚴 المناديب</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="assign" style="width:15px;height:15px;accent-color:var(--accent)"> 📍 توزيع الطلبات</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="pickup" style="width:15px;height:15px;accent-color:var(--accent)"> 🏪 استلام من المحل</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="transit" style="width:15px;height:15px;accent-color:var(--accent)"> 🏭 مخزن العبور</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="bosta" style="width:15px;height:15px;accent-color:var(--accent)"> 🚚 بوسطة</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="delivery-sheet" style="width:15px;height:15px;accent-color:var(--accent)"> 🖨️ ورقة التوصيل</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="courier-orders" style="width:15px;height:15px;accent-color:var(--accent)"> 🧑 طلبات المناديب</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="import-excel" style="width:15px;height:15px;accent-color:var(--accent)"> 📥 استيراد Excel</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="problems" style="width:15px;height:15px;accent-color:var(--accent)"> ⚠️ طلبات مشكلة</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="accounting" style="width:15px;height:15px;accent-color:var(--accent)"> 💰 محاسبة المناديب</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="shop-accounting" style="width:15px;height:15px;accent-color:var(--accent)"> 🏪 محاسبة المحل</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="checks" style="width:15px;height:15px;accent-color:var(--accent)"> 📋 الشيكات</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="reports" style="width:15px;height:15px;accent-color:var(--accent)"> 📊 التقارير</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="expiry" style="width:15px;height:15px;accent-color:var(--accent)"> ⏳ تواريخ الصلاحية</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="notifs" style="width:15px;height:15px;accent-color:var(--accent)"> 🔔 الإشعارات</label>
<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''"><input type="checkbox" name="au-page" value="settings" style="width:15px;height:15px;accent-color:var(--accent)"> ⚙️ الإعدادات</label>
        </div>
      </div>
    </div>
    <div class="mft">
      <button class="btn btn-ghost" onclick="closeM('m-add-user')">إلغاء</button>
      <button class="btn btn-primary" onclick="saveUser()">💾 حفظ</button>
    </div>
  </div>
</div>

</body>
</html>
