# A state that still holds a secret

- **When:** The secret stripper refuses a state.
- **Check it runs:** the state is not sent; the step cannot pass yet.
- **Detected by:** secret stripper.

- A state that still matches a secret pattern after stripping is not sent; the item is reported to the user, and
  the step cannot pass until it is resolved.

Then the doer finds where the secret came from (a file, an env value, an account name), and asks the user (kind c)
only for what only the user can tell. It never sends the state with the secret in it.
