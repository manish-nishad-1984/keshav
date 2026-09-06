import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';

export const UserManagementTab = () => (
  <Card>
    <CardContent className="flex flex-col items-start gap-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Users className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium">User Management</p>
        <p className="text-sm text-muted-foreground">
          Add users, assign roles, reset passwords, and suspend or reactivate access from the Users page.
        </p>
      </div>
      <Button asChild>
        <Link to="/users">Go to Users</Link>
      </Button>
    </CardContent>
  </Card>
);
