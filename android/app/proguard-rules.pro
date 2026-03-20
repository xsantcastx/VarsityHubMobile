# Stripe push provisioning — optional module not bundled in stripe-react-native.
# These classes are referenced but never instantiated at runtime.
# Rules match R8's missing_rules.txt output format exactly.
-dontwarn com.stripe.android.pushProvisioning.PushProvisioningActivity$g
-dontwarn com.stripe.android.pushProvisioning.PushProvisioningActivityStarter$Args
-dontwarn com.stripe.android.pushProvisioning.PushProvisioningActivityStarter$Error
-dontwarn com.stripe.android.pushProvisioning.PushProvisioningActivityStarter
-dontwarn com.stripe.android.pushProvisioning.PushProvisioningEphemeralKeyProvider

# Google Tap & Pay — optional, same situation
-dontwarn com.google.android.gms.tapandpay.**
