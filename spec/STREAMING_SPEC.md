# ZENO Continuous Streaming Specification — 水流決済 (Suiryū Kessai)

The Zeno streaming protocol replaces discrete, batched financial settlements with continuous-time linear money streaming.

---

## 1. Mathematical Mechanics

### 1.1 Fundamental Parameters
- **Sender Account ($S$)**: Source liability account with pre-funded escrow.
- **Recipient Account ($R$)**: Destination account absorbing incoming flow.
- **Start Time ($t_{\text{start}}$)**: UNIX millisecond timestamp when flow initiates.
- **Stop Time ($t_{\text{stop}}$)**: Optional UNIX millisecond timestamp when flow terminates.
- **Rate of Flow ($r$)**: Amount in micro-yen per second ($\mu\text{JPY/sec}$). Note that $1\,\text{JPY} = 1,000,000\,\mu\text{JPY}$.

### 1.2 Transferred Amount at Instant $t$
For $t \ge t_{\text{start}}$:
$$V(t) = \begin{cases}
0 & t < t_{\text{start}} \\
r \cdot \frac{t - t_{\text{start}}}{1000} & t_{\text{start}} \le t < t_{\text{stop}} \\
r \cdot \frac{t_{\text{stop}} - t_{\text{start}}}{1000} & t \ge t_{\text{stop}}
\end{cases}$$

### 1.3 Available Balances
$$\text{Balance}_S(t) = \text{Balance}_S(t_0) - V(t)$$
$$\text{Balance}_R(t) = \text{Balance}_R(t_0) + V(t)$$

---

## 2. Stream State Lifecycle

```
[ CREATED ] ──> [ STREAMING ] ──┬──> [ PAUSED ] ──> [ RESUMED ]
                                ├──> [ COMPLETED ] (Reached t_stop or max_cap)
                                └──> [ CANCELLED ] (Remainder refunded to S)
```

1. **Active**: Both sender and receiver see numbers updating continuously at monitor refresh rate ($60\,\text{Hz} / 120\,\text{Hz}$).
2. **Periodic Checkpoint**: Every $3600\,\text{seconds}$ or upon explicit withdrawal / stop, a settlement transaction is posted to the Kintsugi ledger, committing the accrued state.
3. **Insolvency Guard**: If sender unstreamed balance drops to zero, the stream is automatically paused without penalty or overdraft fees.

---

## 3. High-Throughput Edge Interpolation

Because calculation is purely a linear equation in $t$:
$$v = r \cdot \Delta t$$
edge nodes (Cloudflare Workers) and browser clients calculate balances locally with $O(1)$ CPU time and zero database writes until checkpointing.
