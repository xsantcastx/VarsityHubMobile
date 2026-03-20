# Stripe push provisioning — optional module referenced by stripe-react-native
# but not included in the build (push provisioning is not used).
# R8 treats missing classes as errors even with -dontwarn in full mode.
-dontwarn com.stripe.android.pushProvisioning.**

# Tell R8 to treat missing classes as warnings, not errors
-ignorewarnings
