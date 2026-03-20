# Stripe push provisioning — optional module referenced by stripe-react-native
# but not included in the build (push provisioning is not used).
# R8 treats missing classes as errors; these rules suppress them.
-dontwarn com.stripe.android.pushProvisioning.**
