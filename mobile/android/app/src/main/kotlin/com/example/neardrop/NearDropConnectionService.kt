package com.example.neardrop

import android.os.Bundle
import android.telecom.CallAudioState
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager

/**
 * ConnectionService implementation required for MANAGE_OWN_CALLS permission.
 *
 * This service is declared in AndroidManifest.xml with the
 * BIND_TELECOM_CONNECTION_SERVICE permission so Android's Telecom framework
 * can bind to it when a VoIP call is placed or received via ACS.
 *
 * Flutter communicates with this service through the ACS Calling SDK which
 * uses the Telecom framework internally when MANAGE_OWN_CALLS is held.
 */
class NearDropConnectionService : ConnectionService() {

    companion object {
        /** The currently active connection, if any. Nullable — no active call = null. */
        @Volatile
        var activeConnection: NearDropConnection? = null
    }

    // ── Outgoing calls ────────────────────────────────────────────────────────

    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ): Connection {
        val connection = NearDropConnection()

        // Propagate caller display name if provided in extras
        val displayName = request?.extras?.getString("CALLER_DISPLAY_NAME")
            ?: request?.address?.schemeSpecificPart
            ?: "Customer"
        connection.setCallerDisplayName(
            displayName,
            TelecomManager.PRESENTATION_ALLOWED,
        )

        connection.setDialing()
        activeConnection = connection
        return connection
    }

    override fun onCreateOutgoingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ) {
        activeConnection = null
    }

    // ── Incoming calls ────────────────────────────────────────────────────────

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ): Connection {
        val connection = NearDropConnection()
        connection.setRinging()
        activeConnection = connection
        return connection
    }

    override fun onCreateIncomingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ) {
        activeConnection = null
    }
}

/**
 * Represents a single in-progress call managed by the Telecom framework.
 *
 * ACS Calling SDK will call the lifecycle methods here when the call state
 * changes (answered, held, disconnected, etc.).  We mirror the state changes
 * back to the Telecom framework and clear [NearDropConnectionService.activeConnection]
 * when the call ends.
 */
class NearDropConnection : Connection() {

    init {
        // Allow HOLD and MUTE capabilities — required by some carriers
        connectionCapabilities =
            CAPABILITY_HOLD or CAPABILITY_SUPPORT_HOLD or CAPABILITY_MUTE
    }

    override fun onStateChanged(state: Int) {
        super.onStateChanged(state)
    }

    override fun onAnswer() {
        setActive()
    }

    override fun onReject() {
        setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        destroy()
        NearDropConnectionService.activeConnection = null
    }

    override fun onDisconnect() {
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
        NearDropConnectionService.activeConnection = null
    }

    override fun onHold() {
        setOnHold()
    }

    override fun onUnhold() {
        setActive()
    }

    override fun onCallAudioStateChanged(state: CallAudioState?) {
        super.onCallAudioStateChanged(state)
        // Could route audio to speaker/earpiece here based on state
    }

    override fun onPlayDtmfTone(c: Char) {
        // Forward DTMF tones if needed
    }
}
