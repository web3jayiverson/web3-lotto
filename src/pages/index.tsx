import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect } from 'react';
import lotteryABI from '../../abi.json'; 

// 🔴 保持合约地址不变
const CONTRACT_ADDRESS = "0x56C141DF686ce3C0Ab724427f43803aD12e47cdb"; 
const AUTO_THRESHOLD = 0.1;

// --- CSS 样式表 (核心：通过媒体查询实现手机/电脑自适应) ---
const cssStyles = `
  /* 全局重置 */
  * { box-sizing: border-box; }
  body { margin: 0; background-color: #f1f5f9; color: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

  /* 容器 */
  .container { min-height: 100vh; padding: 15px; }
  .wrapper { max-width: 1100px; margin: 0 auto; }

  /* 导航栏 */
  .nav {
    display: flex; flex-direction: column; gap: 15px;
    background: white; padding: 15px; border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 20px;
  }
  .nav-header { display: flex; align-items: center; gap: 8px; }
  .nav-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  /* 主网格布局 (响应式核心) */
  .main-grid {
    display: grid; 
    grid-template-columns: 1fr; /* 手机默认单栏 */
    gap: 20px; align-items: start;
  }

  /* 电脑端 (宽度大于 768px 时) 切换为双栏 */
  @media (min-width: 768px) {
    .nav { flex-direction: row; justify-content: space-between; }
    .main-grid { grid-template-columns: 320px 1fr; }
  }

  /* 卡片通用样式 */
  .card {
    background: white; padding: 20px; border-radius: 16px;
    margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    border: 1px solid #e2e8f0;
  }
  .card-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }

  /* 球的容器 (弹性布局，自动换行) */
  .ball-container { display: flex; flex-wrap: wrap; gap: 8px; }
  .ball {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: bold; font-size: 13px; cursor: pointer;
    transition: transform 0.1s; user-select: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .ball:active { transform: scale(0.9); }

  /* 进度条 */
  .progress-bg { width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; margin-top: 10px; overflow: hidden; }
  .progress-fill { height: 100%; background: #4ade80; transition: width 0.5s ease; }

  /* 按钮 */
  .btn-primary {
    width: 100%; padding: 14px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white; font-weight: bold; font-size: 15px; cursor: pointer;
    transition: opacity 0.2s; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2);
  }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-outline {
    padding: 6px 12px; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1;
    border-radius: 8px; background: white; color: #475569;
  }
`;

// --- 子组件：历史记录 ---
const HistoryRow = ({ roundId, contractAddress }: { roundId: number, contractAddress: any }) => {
    const { data: result } = useReadContract({
        address: contractAddress, abi: lotteryABI, functionName: 'getRoundResult', args: [BigInt(roundId)],
    });
    if (!result || !Array.isArray(result) || result[0] === 0) return null;
    return (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed #e2e8f0', fontSize:'12px'}}>
            <div style={{color:'#64748b', width:'50px'}}>#{roundId}期</div>
            <div style={{display:'flex', gap:'4px'}}>
                {(result as any[]).slice(0,6).map((n:number, i:number) => (
                     <span key={i} style={{width:'20px', height:'20px', background:'#fee2e2', color:'#ef4444', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:'10px'}}>{Number(n)}</span>
                ))}
                <span style={{width:'20px', height:'20px', background:'#dbeafe', color:'#3b82f6', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:'10px'}}>{Number((result as any[])[6])}</span>
            </div>
        </div>
    );
};

export default function Home() {
  const { address } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [selectedReds, setSelectedReds] = useState<number[]>([]);
  const [selectedBlue, setSelectedBlue] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<string>("0.001"); 

  const { data: potBalance, refetch: refetchPot } = useReadContract({
    address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'getPot',
  });
  const { data: lotteryStatus, refetch: refetchStatus } = useReadContract({
    address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'status',
  });
  const { data: ownerAddress } = useReadContract({
    address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'owner', 
  });
  const { data: currentRoundId, refetch: refetchRound } = useReadContract({
    address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'currentRoundId', 
  });
  const { data: myTickets, refetch: refetchTickets } = useReadContract({
    address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'getMyTicketsWithStatus', account: address, 
  });

  const currId = currentRoundId ? Number(currentRoundId) : 1;
  const historyIds = Array.from({length: 5}, (_, i) => currId - 1 - i).filter(id => id > 0);
  const isAdmin = address && ownerAddress && (address.toLowerCase() === (ownerAddress as string).toLowerCase());
  const currentPotEth = potBalance ? parseFloat(formatEther(potBalance as bigint)) : 0;
  const canAutoDraw = currentPotEth >= AUTO_THRESHOLD;
  const progressPercent = Math.min((currentPotEth / AUTO_THRESHOLD) * 100, 100);

  const isAmountValid = () => {
    const val = parseFloat(betAmount);
    return !isNaN(val) && val >= 0.001 && val <= 0.01;
  };

  const toggleRed = (num: number) => {
    if (selectedReds.includes(num)) setSelectedReds(prev => prev.filter(n => n !== num).sort((a,b)=>a-b));
    else if (selectedReds.length < 6) setSelectedReds(prev => [...prev, num].sort((a,b)=>a-b));
    else alert("红球限选 6 个");
  };
  const toggleBlue = (num: number) => selectedBlue === num ? setSelectedBlue(0) : setSelectedBlue(num);
  const randomPick = () => {
    const reds = new Set<number>();
    while(reds.size < 6) reds.add(Math.floor(Math.random() * 33) + 1);
    setSelectedReds(Array.from(reds).sort((a,b) => a-b));
    setSelectedBlue(Math.floor(Math.random() * 16) + 1);
  };

  const handleBuy = () => {
    if(selectedReds.length !== 6 || selectedBlue === 0) return alert("请完整选号");
    if(!isAmountValid()) return alert("金额 0.001-0.01");
    writeContract({ address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'buyTicket', args: [selectedReds, selectedBlue], value: parseEther(betAmount) });
  };
  const handleDraw = () => writeContract({ address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'drawRound' });
  const handleClaim = (tid: bigint) => writeContract({ address: CONTRACT_ADDRESS, abi: lotteryABI, functionName: 'claimPrize', args: [tid] });
  const refreshAll = () => { refetchPot(); refetchTickets(); refetchRound(); refetchStatus(); };

  useEffect(() => { if (isConfirmed) { alert("✅ 交易成功！"); refreshAll(); } }, [isConfirmed]);

  const checkWinStatus = (item: any) => {
    const { ticketData, roundResult, isRoundFinished } = item;
    if (!isRoundFinished) return { label: '⏳ 待开', color: '#94a3b8', bg:'#f1f5f9' };
    if (ticketData.isClaimed) return { label: '✅ 已领', color: '#16a34a', bg:'#dcfce7' };
    let redHits = 0;
    for(let i=0; i<6; i++) for(let j=0; j<6; j++) if(ticketData.redNumbers[i] === roundResult[j]) redHits++;
    const blueHit = (ticketData.blueNumber === roundResult[6]);
    if ((redHits >= 3) || blueHit) return { label: '🎉 中奖', color: '#ea580c', bg:'#ffedd5', canClaim: true };
    return { label: '💨 未中', color: '#64748b', bg:'#f1f5f9' };
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: cssStyles}} />
      <div className="container">
        <div className="wrapper">
          {/* 导航栏 */}
          <nav className="nav">
              <div className="nav-header">
                  <span style={{fontSize:'24px'}}>🎱</span>
                  <div>
                      <div style={{fontWeight:'800', fontSize:'18px', color:'#1e293b', lineHeight:'1.2'}}>Web3 Lotto 双色球</div>
                      <div style={{fontSize:'11px', color:'#64748b'}}>去中心化乐透游戏(链上开奖 仅供娱乐)</div>
                  </div>
              </div>
              <div className="nav-actions">
                  <div style={{fontSize:'12px', color:'#64748b', background:'#f8fafc', padding:'6px 12px', borderRadius:'20px'}}>
                      期数: <b>#{currentRoundId ? currentRoundId.toString() : '-'}</b>
                  </div>
                  <button onClick={refreshAll} className="btn-outline">🔄 刷新</button>
                  <ConnectButton showBalance={false} />
              </div>
          </nav>

          <div className="main-grid">
              {/* 左侧区域 */}
              <div>
                {/* 奖池 */}
                <div className="card" style={{background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color:'white', border:'none'}}>
                    <div style={{fontSize:'11px', opacity:0.8, letterSpacing:'1px', fontWeight:'600'}}>CURRENT JACKPOT 奖池</div>
                    <div style={{fontSize:'32px', fontWeight:'800', margin:'8px 0'}}>
                        {potBalance ? formatEther(potBalance as bigint) : '0'} <span style={{fontSize:'16px'}}>ETH</span>
                    </div>
                    <div style={{fontSize:'11px', display:'flex', justifyContent:'space-between', opacity:0.9, marginTop:'15px'}}>
                        <span>进度: {progressPercent.toFixed(0)}%</span>
                        <span>目标: {AUTO_THRESHOLD} ETH</span>
                    </div>
                    <div className="progress-bg">
                        <div className="progress-fill" style={{width:`${progressPercent}%`}}></div>
                    </div>
                    <div style={{marginTop:'15px', fontSize:'12px', background:'rgba(255,255,255,0.15)', padding:'8px', borderRadius:'8px', textAlign:'center', fontWeight:'500'}}>
                        {lotteryStatus === 1 ? '🟠 开奖计算中 (VRF)...' : canAutoDraw ? '⚡ 奖池已满，等待触发！' : '🟢 奖池累积中...'}
                    </div>
                </div>

                {/* 往期历史 */}
                <div className="card">
                    <div className="card-title">🏆 往期开奖 (History)</div>
                    {historyIds.length === 0 ? <div style={{textAlign:'center', fontSize:'12px', color:'#94a3b8'}}>等待首轮开奖...</div> : (
                        <div>{historyIds.map(id => <HistoryRow key={id} roundId={id} contractAddress={CONTRACT_ADDRESS} />)}</div>
                    )}
                </div>

                {/* 规则 */}
                <div className="card">
                    <div className="card-title">📖 游戏规则</div>
                    <div style={{fontSize:'12px', marginBottom:'6px', display:'flex', justifyContent:'space-between', color:'#64748b'}}><span>🔵 中蓝球</span> <b style={{color:'#3b82f6'}}>3 倍</b></div>
                    <div style={{fontSize:'12px', marginBottom:'6px', display:'flex', justifyContent:'space-between', color:'#64748b'}}><span>🔴 3 红</span> <b>1 倍</b></div>
                    <div style={{fontSize:'12px', marginBottom:'6px', display:'flex', justifyContent:'space-between', color:'#64748b'}}><span>🔴 6 红</span> <b>10 倍</b></div>
                    <div style={{fontSize:'12px', marginBottom:'6px', display:'flex', justifyContent:'space-between', color:'#ea580c', fontWeight:'bold'}}><span>👑 6红+1蓝</span> <span>奖池 80%</span></div>
                    <div style={{marginTop:'12px', paddingTop:'10px', borderTop:'1px dashed #e2e8f0', fontSize:'11px', color:'#64748b'}}>
                        ⚠️ <b>限额:</b> 0.001 - 0.01 ETH<br/>满 0.1 ETH 激活自动开奖。
                    </div>
                </div>

                {/* 开奖控制台 */}
                {(isAdmin || canAutoDraw) && (
                    <div className="card" style={{border: canAutoDraw ? '2px solid #ea580c' : '1px solid #7c3aed', background: canAutoDraw ? '#fff7ed' : '#f5f3ff'}}>
                        <div style={{fontSize:'13px', fontWeight:'bold', color: canAutoDraw ? '#ea580c' : '#7c3aed', marginBottom:'8px', textAlign:'center'}}>
                            {canAutoDraw ? '🔥 全民开奖通道已开启' : '👑 管理员控制台'}
                        </div>
                        <button onClick={handleDraw} disabled={lotteryStatus!==0} 
                        className="btn-primary" style={{background: canAutoDraw ? '#ea580c' : '#7c3aed'}}>
                        🚀 {lotteryStatus!==0 ? '正在开奖...' : '立即开奖'}
                        </button>
                    </div>
                )}
              </div>

              {/* 右侧区域 */}
              <div>
                <div className="card">
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', alignItems:'center'}}>
                        <div className="card-title"><span style={{fontSize:'18px'}}>🎟️</span> 选号与投注</div>
                        <button onClick={randomPick} className="btn-outline">🎲 机选</button>
                    </div>
                    
                    <div style={{fontSize:'12px', color:'#ef4444', marginBottom:'8px', fontWeight:'bold'}}>红球 (选6个)</div>
                    <div className="ball-container" style={{marginBottom:'20px'}}>
                        {Array.from({length: 33}, (_, i) => i + 1).map(n => (
                            <div key={`r${n}`} onClick={() => toggleRed(n)} className="ball"
                            style={{background: selectedReds.includes(n) ? '#ef4444' : '#f8fafc', color: selectedReds.includes(n) ? 'white' : '#64748b'}}>
                            {n}
                            </div>
                        ))}
                    </div>

                    <div style={{fontSize:'12px', color:'#3b82f6', marginBottom:'8px', fontWeight:'bold'}}>蓝球 (选1个)</div>
                    <div className="ball-container">
                        {Array.from({length: 16}, (_, i) => i + 1).map(n => (
                            <div key={`b${n}`} onClick={() => toggleBlue(n)} className="ball"
                            style={{background: selectedBlue === n ? '#3b82f6' : '#f8fafc', color: selectedBlue === n ? 'white' : '#64748b'}}>
                            {n}
                            </div>
                        ))}
                    </div>

                    <div style={{background:'#f8fafc', padding:'15px', borderRadius:'12px', marginTop:'25px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#64748b', marginBottom:'8px'}}>
                            <span>投注金额 (ETH)</span>
                            <span>余额: {balanceData?.formatted ? Number(balanceData.formatted).toFixed(4) : '-'}</span>
                        </div>
                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                            <input type="number" step="0.001" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} 
                                    style={{flex:1, padding:'12px', borderRadius:'10px', border:'1px solid #cbd5e1', fontSize:'15px', outline:'none', fontWeight:'bold'}} />
                            <button onClick={handleBuy} disabled={lotteryStatus!==0 || !isAmountValid()} className="btn-primary" 
                                    style={{flex:2, opacity:(lotteryStatus!==0 || !isAmountValid())?0.5:1}}>
                                {lotteryStatus!==0 ? '等待开奖...' : `确认支付`}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-title">📜 我的购买记录</div>
                    {!myTickets || (myTickets as any[]).length === 0 ? <div style={{textAlign:'center', padding:'30px', fontSize:'12px', color:'#cbd5e1'}}>暂无购买记录</div> : (
                        <div style={{maxHeight:'400px', overflowY:'auto', paddingRight:'5px'}}>
                            {(myTickets as any[]).map((item: any) => {
                            const { label, color, bg, canClaim } = checkWinStatus(item);
                            const t = item.ticketData;
                            return (
                                <div key={item.ticketId} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #f1f5f9'}}>
                                    <div>
                                        <div style={{fontSize:'11px', color:'#94a3b8', marginBottom:'4px'}}>
                                            #{t.roundId.toString()}期 • {formatEther(t.paidAmount)} ETH
                                        </div>
                                        <div style={{display:'flex', gap:'3px'}}>
                                            {t.redNumbers.map((n:number, i:number) => <span key={i} style={{fontSize:'10px', width:'18px', height:'18px', background:'#fee2e2', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', fontWeight:'bold'}}>{n}</span>)}
                                            <span style={{fontSize:'10px', width:'18px', height:'18px', background:'#dbeafe', color:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', fontWeight:'bold'}}>{t.blueNumber}</span>
                                        </div>
                                    </div>
                                    <div style={{textAlign:'right'}}>
                                        <div style={{fontSize:'11px', padding:'3px 8px', borderRadius:'6px', background:bg, color:color, fontWeight:'bold', display:'inline-block'}}>{label}</div>
                                        {canClaim && <div onClick={() => handleClaim(item.ticketId)} style={{fontSize:'11px', color:'#2563eb', textDecoration:'underline', cursor:'pointer', marginTop:'4px', fontWeight:'600'}}>点击领奖</div>}
                                    </div>
                                </div>
                            )
                            })}
                        </div>
                    )}
                </div>
              </div>
          </div>

          <footer style={{textAlign:'center', marginTop:'40px', padding:'20px', borderTop:'1px solid #cbd5e1', color:'#94a3b8', fontSize:'12px'}}>
              &copy; 2025 Web3 Lotto DApp. All rights reserved.<br/>
              Powered by web3jayiverson
          </footer>
        </div>
      </div>
    </>
  );
}
