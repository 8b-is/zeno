package dev.vaked.zeno.transit

import android.content.Context
import android.content.pm.PackageManager

/**
 * Osaifu-Keitai / Mobile FeliCa capability probe.
 *
 * Suica and PASMO on Android are **not** app-provisioned cards. They live in the
 * Mobile FeliCa secure element and are issued by JR East / the PASMO Association
 * through the Osaifu-Keitai stack (`com.felicanetworks.mfc`). An app can only
 * hand off to the issuer; it cannot mint an IC card, and Android HCE (ISO-DEP
 * type A/B) cannot emulate FeliCa type F.
 *
 * Therefore the honest contract is: probe, explain, and route. Never claim a card
 * was added when it was not.
 */
data class TransitCapability(
    val hasFeliCaHardware: Boolean,
    val hasMfcClient: Boolean,
    val hasSamsungWallet: Boolean,
    val hasMobilePasmo: Boolean,
    val hasMobileSuica: Boolean,
    val hasHceF: Boolean,
    val hasNfc: Boolean,
    val hasGoogleWallet: Boolean,
) {
    /** Osaifu-Keitai is usable only with both the Type-F radio and the MFC client. */
    val osaifuKeitai: Boolean get() = hasFeliCaHardware && hasMfcClient

    /**
     * Tokyo Metro / Toei gates accept contactless EMV (Visa, Mastercard, JCB,
     * Amex, Diners, Discover) and phones holding those cards. This works on
     * devices with no FeliCa at all — the honest tap-to-ride route here.
     */
    val contactlessEmv: Boolean get() = hasNfc && (hasSamsungWallet || hasGoogleWallet)

    val samsungWalletRoute: Route
        get() = when {
            osaifuKeitai && hasSamsungWallet && (hasMobilePasmo || hasMobileSuica) -> Route.ISSUER_THEN_WALLET
            osaifuKeitai && hasSamsungWallet -> Route.ISSUER_REQUIRED
            osaifuKeitai -> Route.ISSUER_APP
            else -> Route.UNSUPPORTED
        }

    val headline: String
        get() = when (samsungWalletRoute) {
            Route.ISSUER_THEN_WALLET -> "IC カードを発行できます"
            Route.ISSUER_REQUIRED -> "IC カードは発行アプリから"
            Route.ISSUER_APP -> "おサイフケータイ対応 · 発行アプリが必要です"
            Route.UNSUPPORTED ->
                if (contactlessEmv) "おサイフケータイ非対応 · コンタクトレス決済で乗車できます"
                else "この端末はおサイフケータイ非対応です"
        }

    val body: String
        get() = when (samsungWalletRoute) {
            Route.ISSUER_THEN_WALLET ->
                "Mobile PASMO / Suica でカードを発行すると、Samsung Wallet の交通系ICとして" +
                    "タッチ決済に使えます。ZENO から発行アプリへ移動してください。"
            Route.ISSUER_REQUIRED ->
                "この端末はおサイフケータイに対応していますが、Suica / PASMO の発行には" +
                    "JR東日本・PASMO協議会の発行アプリが必要です。発行後は Samsung Wallet の" +
                    "「交通系ICカード」欄に自動で表示されます。"
            Route.ISSUER_APP ->
                "おサイフケータイには対応しています。Samsung Wallet が未導入のため、" +
                    "Mobile PASMO / Suica アプリから発行してください。"
            Route.UNSUPPORTED ->
                if (contactlessEmv) {
                    "Mobile FeliCa（Type-F）がないため Suica / PASMO は発行できませんが、" +
                        "東京メトロ・都営地下鉄の改札はコンタクトレス決済（Visa / Mastercard / " +
                        "JCB / Amex）に対応しています。Samsung Wallet に銀行カードを追加すれば、" +
                        "この端末のまま改札と店頭でタッチできます。JR東日本の改札は駅により" +
                        "対応が異なるため、改札のマークを確認してください。"
                } else {
                    "Mobile FeliCa（Type-F）チップと Osaifu-Keitai クライアント" +
                        "（com.felicanetworks.mfc）がこの端末にありません。Suica / PASMO は" +
                        "発行できず、Samsung Wallet の交通系ICにも追加できません。" +
                        "日本国内モデルの Galaxy か、物理 IC カードをご利用ください。"
                }
        }

    val detail: String
        get() = buildString {
            append("FeliCa hardware: ").append(flag(hasFeliCaHardware)).append('\n')
            append("MFC client (osaihu): ").append(flag(hasMfcClient)).append('\n')
            append("HCE-F API: ").append(flag(hasHceF)).append('\n')
            append("NFC + wallet (EMV): ").append(flag(contactlessEmv)).append('\n')
            append("Samsung Wallet: ").append(flag(hasSamsungWallet)).append('\n')
            append("Google Wallet: ").append(flag(hasGoogleWallet)).append('\n')
            append("Mobile PASMO: ").append(flag(hasMobilePasmo)).append('\n')
            append("Mobile Suica: ").append(flag(hasMobileSuica)).append('\n')
            append("Verdict: ").append(if (osaifuKeitai) "OSAIFU-KEITAI READY" else "NO OSAIFU-KEITAI")
                .append(if (contactlessEmv) " · CONTACTLESS EMV READY" else "")
        }

    private fun flag(value: Boolean) = if (value) "✓ present" else "✗ absent"

    enum class Route { ISSUER_THEN_WALLET, ISSUER_REQUIRED, ISSUER_APP, UNSUPPORTED }

    companion object {
        const val PACKAGE_SAMSUNG_WALLET = "com.samsung.android.spay"
        const val PACKAGE_GOOGLE_WALLET = "com.google.android.apps.walletnfcrel"
        const val PACKAGE_MOBILE_PASMO = "com.mobilepasmo.android"
        const val PACKAGE_MOBILE_SUICA = "com.jreast.mobile.suica"
        const val PACKAGE_MFC_CLIENT = "com.felicanetworks.mfc"

        fun probe(context: Context): TransitCapability {
            val pm = context.packageManager
            return TransitCapability(
                hasFeliCaHardware = pm.hasSystemFeature("android.hardware.nfc.felica"),
                hasMfcClient = isInstalled(pm, PACKAGE_MFC_CLIENT),
                hasSamsungWallet = isInstalled(pm, PACKAGE_SAMSUNG_WALLET),
                hasMobilePasmo = isInstalled(pm, PACKAGE_MOBILE_PASMO),
                hasMobileSuica = isInstalled(pm, PACKAGE_MOBILE_SUICA),
                hasHceF = pm.hasSystemFeature("android.hardware.nfc.hcef"),
                hasNfc = pm.hasSystemFeature(PackageManager.FEATURE_NFC),
                hasGoogleWallet = isInstalled(pm, PACKAGE_GOOGLE_WALLET),
            )
        }

        private fun isInstalled(pm: PackageManager, id: String): Boolean = try {
            pm.getPackageInfo(id, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }
}
