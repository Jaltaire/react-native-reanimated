package com.swmansion.reanimated.nativeProxy

import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerModule
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.RCTModernEventEmitter

@DoNotStrip
class EventHandler : RCTModernEventEmitter {
    @field:DoNotStrip
    private val mHybridData: HybridData

    var mCustomEventNamesResolver: UIManagerModule.CustomEventNamesResolver? = null
    internal var isInDrawPassProvider: (() -> Boolean)? = null
    internal var nativeCallGuard: (() -> Unit) -> Unit = { it() }
    internal var handlerWaitingProvider: ((String, Int) -> Boolean)? = null
    private var forwardedAnyEvent = false

    @DoNotStrip
    private constructor(hybridData: HybridData) {
        mHybridData = hybridData
    }

    private fun isInDrawPass(): Boolean = isInDrawPassProvider?.invoke() == true

    override fun receiveEvent(
        surfaceId: Int,
        targetTag: Int,
        eventName: String,
        canCoalesceEvent: Boolean,
        customCoalesceKey: Int,
        params: WritableMap?,
        category: Int,
    ) {
        handle(eventName, targetTag, params)
    }

    override fun receiveEvent(
        surfaceId: Int,
        targetTag: Int,
        eventName: String,
        params: WritableMap?,
    ) {
        handle(eventName, targetTag, params)
    }

    override fun receiveEvent(
        targetTag: Int,
        eventName: String,
        params: WritableMap?,
    ) {
        handle(eventName, targetTag, params)
    }

    private fun handle(
        eventName: String,
        targetTag: Int,
        params: WritableMap?,
    ) {
        val resolvedEventName = mCustomEventNamesResolver!!.resolveCustomEventName(eventName) ?: eventName
        if (handlerWaitingProvider?.invoke(resolvedEventName, targetTag) == false) {
            return
        }
        forwardedAnyEvent = true
        nativeCallGuard { receiveEvent(resolvedEventName, targetTag, params, isInDrawPass()) }
    }

    internal fun dispatch(event: Event<*>): Boolean {
        forwardedAnyEvent = false
        event.dispatchModern(this)
        return forwardedAnyEvent
    }

    override fun receiveTouches(
        eventName: String,
        touches: WritableArray,
        changedIndices: WritableArray,
    ) {
        // not interested in processing touch events this way, we process raw events only
    }

    external fun receiveEvent(
        eventName: String,
        emitterReactTag: Int,
        event: WritableMap?,
        isInDrawPass: Boolean,
    )
}
