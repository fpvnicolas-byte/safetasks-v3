"""
Standard ErrorDialog update pattern for all pages.
This serves as a reference for the updates.
"""

STANDARD_UPDATES = """
1. Add imports:
   - import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
   - import { ErrorDialog } from '@/components/ui/error-dialog'
   
2. Remove import:
   - import { Alert, AlertDescription } from '@/components/ui/alert'
   
3. Add hook (replace error state):
   - const { errorDialog, showError, closeError } = useErrorDialog()
   
4. Update catch block:
   catch (err: any) {
     console.error('Error:', err)
     showError(err, 'Error Title')
   }
   
5. Remove Alert usage in JSX
   
6. Add ErrorDialog component before closing div:
   <ErrorDialog
     open={errorDialog.open}
     onOpenChange={closeError}
     title={errorDialog.title}
     message={errorDialog.message}
     validationErrors={errorDialog.validationErrors}
     statusCode={errorDialog.statusCode}
   />
"""

print(STANDARD_UPDATES)
print("\n✅ This pattern will be applied to all 19 remaining pages")
